using System.Security.Claims;
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace LawyerProject.Application.Chats.Queries;

public record GetChatRoomsQuery : IRequest<List<ChatRoomDto>>;

public class GetChatRoomsQueryHandler : IRequestHandler<GetChatRoomsQuery, List<ChatRoomDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public GetChatRoomsQueryHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<List<ChatRoomDto>> Handle(GetChatRoomsQuery request, CancellationToken cancellationToken)
    {
        var userId = _user.Id;
        if (string.IsNullOrEmpty(userId))
        {
            return new List<ChatRoomDto>(); // یا خطا، اگر کاربر باید حتما لاگین باشد
        }

        var userChatRooms = await _context.ChatRoomMembers
            .Where(m => m.UserId == userId)
            .Include(m => m.ChatRoom)
                .ThenInclude(cr => cr.Members) // برای دسترسی به سایر اعضا برای نام و آواتار در چت خصوصی
                    .ThenInclude(crm => crm.User)
            .Include(m => m.ChatRoom)
                .ThenInclude(cr => cr.Messages) // برای دسترسی به پیام‌ها برای آخرین پیام و تعداد
                    .ThenInclude(msg => msg.Sender) // برای نام فرستنده آخرین پیام
            .Select(m => m.ChatRoom)
            .ToListAsync(cancellationToken);

        var resultDtoList = new List<ChatRoomDto>();

        foreach (var room in userChatRooms)
        {
            var lastMessage = room.Messages.OrderByDescending(msg => msg.Created).FirstOrDefault();
            int totalMessages = room.Messages.Count();

            // پیدا کردن رکورد ChatRoomMember برای کاربر فعلی و این روم
            var currentChatRoomMember = await _context.ChatRoomMembers
                .FirstOrDefaultAsync(crm => crm.ChatRoomId == room.Id && crm.UserId == userId, cancellationToken);

            int unreadCount = 0;
            if (currentChatRoomMember != null)
            {
                unreadCount = await _context.ChatMessages
                    .CountAsync(m => m.ChatRoomId == room.Id &&
                                     m.SenderId != userId && // پیام‌هایی که خودش نفرستاده
                                     m.Id > (currentChatRoomMember.LastReadMessageId ?? 0), // پیام‌های جدیدتر از آخرین پیام خوانده شده
                                     cancellationToken);
            }
            // else: لاگ خطا، کاربر باید عضو باشد تا اطلاعات روم را دریافت کند.

            string roomName = room.Name;
            string? roomAvatar = room.Avatar;

            if (!room.IsGroup && room.Members.Count == 2)
            {
                var otherMemberInfo = room.Members.FirstOrDefault(m => m.UserId != userId);
                if (otherMemberInfo?.User != null)
                {
                    roomName = otherMemberInfo.User.UserName!;
                    roomAvatar = otherMemberInfo.User.Avatar;
                }
            }

            resultDtoList.Add(new ChatRoomDto(
                room.Id,
                roomName,
                room.Description,
                room.IsGroup,
                roomAvatar,
                room.Created,
                totalMessages,
                lastMessage?.Content.Length > 50 ? lastMessage.Content.Substring(0, 50) + "..." : lastMessage?.Content,
                lastMessage?.Created,
                lastMessage?.Sender?.UserName,
                unreadCount
            ));
        }

        // مرتب‌سازی نهایی لیست بر اساس زمان آخرین پیام
        return resultDtoList.OrderByDescending(r => r.LastMessageTime ?? r.CreatedAt).ToList();
    }
}
