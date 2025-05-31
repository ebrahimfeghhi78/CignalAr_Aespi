using System.Collections.Concurrent;
using System.Security.Claims;
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Application.Common.Security;
using LawyerProject.Domain.Entities;
using LawyerProject.Domain.Enums;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace LawyerProject.Infrastructure.Hubs;

public class ChatHub : Hub
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private static readonly ConcurrentDictionary<string, int> _typingUsers = new();

    public ChatHub(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = _user.Id;

        if (string.IsNullOrEmpty(userId))
        {
            Context.Abort();
            return;
        }

        // Save connection
        var connection = new UserConnection
        {
            UserId = userId,
            ConnectionId = Context.ConnectionId,
            ConnectedAt = DateTime.UtcNow,
            IsActive = true
        };

        _context.UserConnections.Add(connection);
        await _context.SaveChangesAsync(CancellationToken.None);

        // Join user's chat rooms
        var chatRoomIds = await GetUserChatRoomIds(userId);
        foreach (var roomId in chatRoomIds)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId.ToString());
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = _user.Id;

        // Remove connection
        var connection = _context.UserConnections
            .FirstOrDefault(c => c.ConnectionId == Context.ConnectionId);

        if (connection != null)
        {
            connection.IsActive = false;
            await _context.SaveChangesAsync(CancellationToken.None);
        }

        // Stop typing indicators for this connection
        if (_typingUsers.TryRemove(Context.ConnectionId, out int roomIdWhenDisconnected))
        {
            if (userId != null)
            {
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    var typingDto = new TypingIndicatorDto(
                        userId,
                        user.UserName!,
                        roomIdWhenDisconnected,
                        false
                    );
                    await Clients.Group(roomIdWhenDisconnected.ToString()).SendAsync("UserTyping", typingDto);
                }
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
    }

    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
    }

    public async Task StartTyping(string roomIdStr)
    {
        var userId = _user.Id;
        if (string.IsNullOrEmpty(userId) || !int.TryParse(roomIdStr, out int roomId))
            return;

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return;

        if (_typingUsers.TryGetValue(Context.ConnectionId, out int previousRoomId))
        {
            if (previousRoomId != roomId)
            {
                var previousTypingDto = new TypingIndicatorDto(userId, user.UserName!, previousRoomId, false);
                await Clients.Group(previousRoomId.ToString()).SendAsync("UserTyping", previousTypingDto);
            }
        }

        _typingUsers.AddOrUpdate(Context.ConnectionId, roomId, (connId, oldRoomId) => roomId);

        var typingDto = new TypingIndicatorDto(
            userId,
            user.UserName!,
            roomId,
            true
        );

        await Clients.GroupExcept(roomId.ToString(), Context.ConnectionId)
            .SendAsync("UserTyping", typingDto);
    }

    public async Task StopTyping(string? roomIdStr = null)
    {
        var userId = _user.Id;
        if (string.IsNullOrEmpty(userId)) return;


        if (roomIdStr != null && int.TryParse(roomIdStr, out int roomIdFromParam))
        {
            if (_typingUsers.TryGetValue(Context.ConnectionId, out int currentTypingRoomId) && currentTypingRoomId == roomIdFromParam)
            {
                if (_typingUsers.TryRemove(Context.ConnectionId, out _))
                {
                    var user = await _context.Users.FindAsync(userId);
                    if (user != null)
                    {
                        var typingDto = new TypingIndicatorDto(userId, user.UserName!, roomIdFromParam, false);
                        await Clients.GroupExcept(roomIdFromParam.ToString(), Context.ConnectionId)
                            .SendAsync("UserTyping", typingDto);
                    }
                }
            }
        }
        else if (roomIdStr == null)
        {
            if (_typingUsers.TryRemove(Context.ConnectionId, out int currentTypingRoomId))
            {
                var user = await _context.Users.FindAsync(userId);
                if (user != null)
                {
                    var typingDto = new TypingIndicatorDto(userId, user.UserName!, currentTypingRoomId, false);

                    await Clients.Group(currentTypingRoomId.ToString()).SendAsync("UserTyping", typingDto);
                }
            }
        }
    }

    public async Task MarkMessageAsRead(string messageIdStr, string roomIdStr)
    {
        var userId = _user.Id;
        if (string.IsNullOrEmpty(userId) ||
            !int.TryParse(messageIdStr, out int msgId) ||
            !int.TryParse(roomIdStr, out int roomId))
        {
            // لاگ خطا یا ارسال خطا به کلاینت
            return;
        }

        var message = await _context.ChatMessages.FindAsync(msgId);
        if (message == null || message.ChatRoomId != roomId)
        {
            // پیام وجود ندارد یا متعلق به این روم نیست
            return;
        }

        // آپدیت یا ایجاد MessageStatus
        var existingStatus = await _context.MessageStatuses
            .FirstOrDefaultAsync(s => s.MessageId == msgId && s.UserId == userId);

        if (existingStatus != null)
        {
            if (existingStatus.Status != ReadStatus.Read) // فقط اگر قبلا خوانده نشده بود
            {
                existingStatus.Status = ReadStatus.Read;
                existingStatus.StatusAt = DateTime.UtcNow;
            }
        }
        else
        {
            var status = new MessageStatus
            {
                MessageId = msgId,
                UserId = userId,
                Status = ReadStatus.Read,
                StatusAt = DateTime.UtcNow
            };
            _context.MessageStatuses.Add(status);
        }

        // آپدیت LastReadMessageId در ChatRoomMember
        var chatRoomMember = await _context.ChatRoomMembers
            .FirstOrDefaultAsync(m => m.UserId == userId && m.ChatRoomId == roomId);

        if (chatRoomMember != null)
        {
            // فقط اگر پیام جدیدتر از آخرین پیام خوانده شده قبلی است، آپدیت کن
            if (chatRoomMember.LastReadMessageId == null || msgId > chatRoomMember.LastReadMessageId)
            {
                chatRoomMember.LastReadMessageId = msgId;
            }
        }
        // else: کاربر عضو این روم نیست یا مشکلی وجود دارد، لاگ بگیرید.

        await _context.SaveChangesAsync(CancellationToken.None);

        // Notify sender about read status (و همچنین سایر کلاینت‌های کاربر دریافت کننده)
        // ارسال ChatRoomId هم مفید است تا کلاینت بداند کدام لیست پیام را آپدیت کند.
        if (message.SenderId != null && message.SenderId != userId) // فقط به فرستنده (اگر خودش نباشد) اطلاع بده
        {
            await Clients.User(message.SenderId)
               .SendAsync("MessageRead", new { MessageId = msgId, ReadBy = userId, ChatRoomId = roomId });
        }
        // همچنین به سایر کانکشن‌های همین کاربر (خواننده پیام) هم می‌توان اطلاع داد که UI آپدیت شود
        await Clients.User(userId)
                .SendAsync("MessageReadReceipt", new { MessageId = msgId, ChatRoomId = roomId, Status = ReadStatus.Read });


    }
  
    private async Task<List<int>> GetUserChatRoomIds(string? userId)
    {
        return await Task.Run(() =>
            _context.ChatRoomMembers
                .Where(m => m.UserId == userId)
                .Select(m => m.ChatRoomId)
                .ToList()
        );
    }
}
