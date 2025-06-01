// File: BackEnd/Commands/ForwardMessageCommand.cs
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using LawyerProject.Domain.Enums; // For MessageType
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LawyerProject.Application.Chats.Commands;

public record ForwardMessageCommand(
    int OriginalMessageId,
    int TargetChatRoomId
// We will use the current user as the forwarder.
) : IRequest<ChatMessageDto>; // Returns the DTO of the new, forwarded message

public class ForwardMessageCommandHandler : IRequestHandler<ForwardMessageCommand, ChatMessageDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user; // To identify the forwarder
    private readonly IChatHubService _chatHubService;
    // private readonly IMediator _mediator; // If SendMessageCommand is called internally

    public ForwardMessageCommandHandler(IApplicationDbContext context, IUser user, IChatHubService chatHubService /*, IMediator mediator*/)
    {
        _context = context;
        _user = user;
        _chatHubService = chatHubService;
        // _mediator = mediator;
    }

    public async Task<ChatMessageDto> Handle(ForwardMessageCommand request, CancellationToken cancellationToken)
    {
        var forwarderUserId = _user.Id;
        if (string.IsNullOrEmpty(forwarderUserId))
        {
            throw new UnauthorizedAccessException("User is not authenticated to forward a message.");
        }

        var forwarderUser = await _context.Users.FindAsync(new object[] { forwarderUserId }, cancellationToken);
        if (forwarderUser == null)
        {
            throw new KeyNotFoundException("Forwarder user not found.");
        }

        var originalMessage = await _context.ChatMessages
            .Include(m => m.Sender) // We might need original sender's name
            .FirstOrDefaultAsync(m => m.Id == request.OriginalMessageId, cancellationToken);

        if (originalMessage == null)
        {
            throw new KeyNotFoundException($"Original message with Id {request.OriginalMessageId} not found.");
        }

        var targetChatRoom = await _context.ChatRooms
            .Include(cr => cr.Members)
            .FirstOrDefaultAsync(cr => cr.Id == request.TargetChatRoomId, cancellationToken);

        if (targetChatRoom == null)
        {
            throw new KeyNotFoundException($"Target chat room with Id {request.TargetChatRoomId} not found.");
        }

        // Check if the forwarder is a member of the target chat room
        if (!targetChatRoom.Members.Any(m => m.UserId == forwarderUserId))
        {
            throw new UnauthorizedAccessException("User is not a member of the target chat room.");
        }

        // Create new message content indicating it's forwarded
        // Option 1: Prepend text
        string forwardedContent = $"[فوروارد شده از: {originalMessage.Sender.UserName}]\n{originalMessage.Content}";
        if (originalMessage.Type != MessageType.Text && !string.IsNullOrEmpty(originalMessage.Content))
        { // If original message had content with attachment
            forwardedContent = $"[فوروارد شده از: {originalMessage.Sender.UserName}]\n{originalMessage.Content}";
        }
        else if (originalMessage.Type != MessageType.Text && string.IsNullOrEmpty(originalMessage.Content))
        {
            forwardedContent = $"[فوروارد شده از: {originalMessage.Sender.UserName}]";
        }


        // Option 2: Use a specific MessageType if you add MessageType.Forwarded (more complex)

        var forwardedMessage = new ChatMessage
        {
            Content = forwardedContent,
            SenderId = forwarderUserId, // The user who forwards it is the sender in the target room
            ChatRoomId = request.TargetChatRoomId,
            Type = originalMessage.Type, // Keep the original type for attachments
            AttachmentUrl = originalMessage.AttachmentUrl, // Copy attachment
            // AttachmentType = originalMessage.AttachmentType, // Copy attachment type
            // ReplyToMessageId = null, // Forwarded messages usually don't reply to something in the target room
            Created = DateTime.UtcNow // Set new creation time
        };

        _context.ChatMessages.Add(forwardedMessage);
        await _context.SaveChangesAsync(cancellationToken);

        // DTO for the newly created forwarded message
        var messageDto = new ChatMessageDto(
            forwardedMessage.Id,
            forwardedMessage.Content,
            forwardedMessage.SenderId,
            forwarderUser.UserName!,
            $"{forwarderUser.FirstName} {forwarderUser.LastName}",  // Added SenderFullName
            forwarderUser.Avatar,
            forwardedMessage.ChatRoomId,
            forwardedMessage.Type,
            forwardedMessage.AttachmentUrl,
            null, // No reply for forwarded message
            forwardedMessage.Created,
            false, // Not edited
            null,  // No edit date
            null, null, null, // No replied message info for a new forwarded message
            new List<ReactionInfo>() // No reactions initially
        );

        // Send the new (forwarded) message to the target room
        await _chatHubService.SendMessageToRoom(request.TargetChatRoomId.ToString(), messageDto);

        // Update the target chat room's last message info for all its members
        var targetRoomMembers = await _context.ChatRoomMembers
                                        .Where(m => m.ChatRoomId == request.TargetChatRoomId)
                                        .Include(m => m.User)
                                        .ToListAsync(cancellationToken);

        foreach (var member in targetRoomMembers)
        {
            if (member.UserId == null) continue;
            // Calculate unread count for this member in the target room
            int unreadCount = await _context.ChatMessages
                .CountAsync(m => m.ChatRoomId == request.TargetChatRoomId &&
                                 m.SenderId != member.UserId &&
                                 m.Id > (member.LastReadMessageId ?? 0),
                                 cancellationToken);

            string roomNameForMember = targetChatRoom.Name;
            string? roomAvatarForMember = targetChatRoom.Avatar;

            if (!targetChatRoom.IsGroup && targetChatRoom.Members.Count >= 2)
            {
                var otherUserInChat = targetChatRoom.Members.FirstOrDefault(m => m.UserId != member.UserId && m.User != null)?.User;
                if (otherUserInChat != null)
                {
                    roomNameForMember = otherUserInChat.UserName!;
                    roomAvatarForMember = otherUserInChat.Avatar;
                }
            }

            var roomUpdateDto = new ChatRoomDto(
                targetChatRoom.Id,
                roomNameForMember,
                targetChatRoom.Description,
                targetChatRoom.IsGroup,
                roomAvatarForMember,
                targetChatRoom.Created,
                await _context.ChatMessages.CountAsync(m => m.ChatRoomId == targetChatRoom.Id, cancellationToken),
                forwardedMessage.Content.Length > 50 ? forwardedMessage.Content.Substring(0, 50) + "..." : forwardedMessage.Content,
                forwardedMessage.Created,
                forwarderUser.UserName!,
                unreadCount
            );
            await _chatHubService.SendChatRoomUpdateToUser(member.UserId, roomUpdateDto);
        }

        return messageDto;
    }
}
