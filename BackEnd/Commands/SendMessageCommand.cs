using System.Security.Claims;
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using LawyerProject.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace LawyerProject.Application.Chats.Commands;

public record SendMessageCommand(
    int ChatRoomId,
    string Content,
    MessageType Type = MessageType.Text,
    string? AttachmentUrl = null,
    int? ReplyToMessageId = null
) : IRequest<ChatMessageDto>;

public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, ChatMessageDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IChatHubService _chatHubService;
    private readonly IUser _user;

    public SendMessageCommandHandler(
        IApplicationDbContext context,
        IChatHubService chatHubService, IUser user)
    {
        _context = context;
        _chatHubService = chatHubService;
        _user = user;
    }

    public async Task<ChatMessageDto> Handle(SendMessageCommand request, CancellationToken cancellationToken)
    {
        var senderUserId = _user.Id;
        if (string.IsNullOrEmpty(senderUserId))
        {
            // اگر چت پشتیبانی است و فرستنده مهمان است، باید senderId متفاوت باشد
            // این بخش نیاز به منطق بیشتری برای شناسایی مهمان دارد اگر مهمانان هم پیام ارسال می‌کنند
            throw new UnauthorizedAccessException("User is not authenticated to send a message.");
        }

        var chatRoom = await _context.ChatRooms
            .Include(cr => cr.Members) // برای دسترسی به اعضا
                .ThenInclude(m => m.User) // برای دسترسی به اطلاعات کاربر عضو
            .FirstOrDefaultAsync(cr => cr.Id == request.ChatRoomId, cancellationToken);

        if (chatRoom == null)
        {
            throw new KeyNotFoundException($"Chat room with Id {request.ChatRoomId} not found.");
        }

        // بررسی اینکه آیا فرستنده عضو چت روم است (مهم برای امنیت)
        if (!chatRoom.IsSupportRoom && !chatRoom.Members.Any(m => m.UserId == senderUserId))
        {
            // اگر چت پشتیبانی نیست و کاربر عضو نیست، اجازه ارسال نده
            // برای چت پشتیبانی، مهمان ممکن است UserId نداشته باشد و باید متفاوت هندل شود
            throw new UnauthorizedAccessException("User is not a member of this chat room.");
        }


        var message = new ChatMessage
        {
            Content = request.Content,
            SenderId = senderUserId,
            ChatRoomId = request.ChatRoomId,
            Type = request.Type,
            AttachmentUrl = request.AttachmentUrl,
            ReplyToMessageId = request.ReplyToMessageId
        };

        _context.ChatMessages.Add(message);
        await _context.SaveChangesAsync(cancellationToken); // ذخیره پیام برای گرفتن Id و Created

        // Load sender data explicitly for the DTO
        var senderUser = await _context.Users.FindAsync(new object[] { senderUserId! }, cancellationToken);
        if (senderUser == null) { /* Handle error, sender not found */ }

        ChatMessage? repliedMessage = null;
        if (message.ReplyToMessageId.HasValue)
        {
            repliedMessage = await _context.ChatMessages
                .Include(rpm => rpm.Sender)
                .FirstOrDefaultAsync(rpm => rpm.Id == message.ReplyToMessageId.Value, cancellationToken);
        }

        var messageDto = new ChatMessageDto(
            message.Id,
            message.Content,
            message.SenderId,
            senderUser!.UserName!,
            $"{senderUser.FirstName} {senderUser.LastName}",  // Added SenderFullName
            senderUser.Avatar,
            message.ChatRoomId,
            message.Type,
            message.AttachmentUrl,
            message.ReplyToMessageId,
            message.Created,
            message.IsEdited,
            message.EditedAt,
            // Populate replied message info for the new message DTO being broadcasted
            repliedMessage == null ? null : (repliedMessage.Content.Length > 70 ? repliedMessage.Content.Substring(0, 70) + "..." : repliedMessage.Content),
            repliedMessage == null ? null : repliedMessage.Sender.UserName,
            repliedMessage == null ? null : repliedMessage.Type,
            new List<ReactionInfo>()
        );

        // ارسال پیام به تمام کانکشن‌های اعضای گروه در SignalR
        await _chatHubService.SendMessageToRoom(request.ChatRoomId.ToString(), messageDto);

        // به‌روزرسانی اطلاعات چت‌روم برای همه اعضای روم (به جز فرستنده)
        var roomMembers = chatRoom.Members;

        foreach (var member in roomMembers)
        {
            if (member.UserId == senderUserId) continue;

            // اطمینان از اینکه اطلاعات کاربر عضو لود شده است
            if (member.User == null)
            {
                // اگر User لود نشده، آن را جداگانه از context بگیرید
                // این حالت نباید اتفاق بیفتد اگر Include در کوئری اولیه chatRoom درست باشد
                //_logger.LogWarning($"User not loaded for member {member.Id} in room {chatRoom.Id}");
                continue;
            }

            int unreadCount = await _context.ChatMessages
                .CountAsync(m => m.ChatRoomId == request.ChatRoomId &&
                                 m.SenderId != member.UserId && // پیام‌هایی که خودش نفرستاده
                                 m.Id > (member.LastReadMessageId ?? 0), // پیام‌های جدیدتر از آخرین پیام خوانده شده توسط این عضو
                                 cancellationToken);

            string roomNameForMember = chatRoom.Name;
            string? roomAvatarForMember = chatRoom.Avatar;

            if (!chatRoom.IsGroup && chatRoom.Members.Count >= 2) // اطمینان از وجود حداقل دو عضو برای چت خصوصی
            {
                // پیدا کردن "طرف دیگر" مکالمه برای نمایش نام و آواتار او
                // فرستنده فعلی پیام (senderUser) یک طرف است، member طرف دیگر
                var otherUserInChat = (senderUserId == member.UserId) // اگر به دلایلی member همان senderUserId بود (نباید در این حلقه اتفاق بیفتد)
                                    ? chatRoom.Members.FirstOrDefault(m_other => m_other.UserId != senderUserId)?.User
                                    : senderUser; // در حالت عادی، senderUser همان "طرف دیگر" برای member است.

                if (otherUserInChat != null && otherUserInChat.Id != member.UserId)
                {
                    roomNameForMember = otherUserInChat.UserName!;
                    roomAvatarForMember = otherUserInChat.Avatar;
                }
                else if (chatRoom.Members.Count == 2) // اگر فقط دو نفر در روم هستند و یکی از آنها sender است
                {
                    var actualOtherUser = chatRoom.Members.FirstOrDefault(m_other => m_other.UserId != member.UserId)?.User;
                    if (actualOtherUser != null)
                    {
                        roomNameForMember = actualOtherUser.UserName!;
                        roomAvatarForMember = actualOtherUser.Avatar;
                    }
                }
            }


            var roomUpdateDtoForMember = new ChatRoomDto(
                chatRoom.Id,
                roomNameForMember,
                chatRoom.Description,
                chatRoom.IsGroup,
                roomAvatarForMember,
                chatRoom.Created,
                await _context.ChatMessages.CountAsync(m => m.ChatRoomId == chatRoom.Id, cancellationToken),
                message.Content.Length > 50 ? message.Content.Substring(0, 50) + "..." : message.Content,
                message.Created,
                senderUser.UserName!, // نام فرستنده پیام آخر
                unreadCount
            );

            await _chatHubService.SendChatRoomUpdateToUser(member.UserId!, roomUpdateDtoForMember);
        }

        return messageDto;
    }
}
