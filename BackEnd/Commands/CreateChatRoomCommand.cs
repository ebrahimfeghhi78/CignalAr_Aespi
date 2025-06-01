using System.Security.Claims;
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using LawyerProject.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace LawyerProject.Application.Chats.Commands;

public record CreateChatRoomCommand(
    string Name,
    string? Description,
    bool IsGroup,
    List<string>? MemberIds = null,
    int? RegionId = null,
    bool IsSupportRoom = false,
    string? GuestFullName = null,
    string? GuestEmail = null
) : IRequest<ChatRoomDto>;

public class CreateChatRoomCommandHandler : IRequestHandler<CreateChatRoomCommand, ChatRoomDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly IChatHubService _chatHubService;


    public CreateChatRoomCommandHandler(IApplicationDbContext context, IUser user, IChatHubService chatHubService)
    {
        _context = context;
        _user = user;
        _chatHubService = chatHubService;
    }

    public async Task<ChatRoomDto> Handle(CreateChatRoomCommand request, CancellationToken cancellationToken)
    {
        var creatorUserId = _user.Id;
        string roomNameForCreator = request.Name;
        var activeRegionId = _user.RegionId;

        if (creatorUserId == null && !request.IsSupportRoom)
        {
            throw new UnauthorizedAccessException("User is not authenticated to create a chat room.");
        }

        if (!request.IsGroup && !request.IsSupportRoom && request.MemberIds != null && request.MemberIds.Count == 1)
        {
            var otherMemberId = request.MemberIds.First();
            if (creatorUserId == otherMemberId)
            {
                throw new InvalidOperationException("Cannot create a private chat with yourself.");
            }

            var existingRoom = await _context.ChatRooms
                .Include(cr => cr.Members)
                .ThenInclude(m => m.User)
                .Include(cr => cr.Messages.OrderByDescending(msg => msg.Created).Take(1))
                .ThenInclude(msg => msg.Sender)
                .FirstOrDefaultAsync(cr =>
                    !cr.IsGroup &&
                    cr.RegionId == activeRegionId && // Check region
                    cr.Members.Count(m => m.UserId == creatorUserId || m.UserId == otherMemberId) == 2 &&
                    cr.Members.All(m => m.UserId == creatorUserId || m.UserId == otherMemberId),
                    cancellationToken);

            if (existingRoom != null)
            {
                // Room already exists, return its DTO
                var otherUser = existingRoom.Members.FirstOrDefault(m => m.UserId == otherMemberId)?.User;
                var lastMessage = existingRoom.Messages.FirstOrDefault();
                int unreadCount = await _context.ChatMessages
                   .CountAsync(m => m.ChatRoomId == existingRoom.Id &&
                                    m.SenderId != creatorUserId &&
                                    m.Id > (existingRoom.Members.FirstOrDefault(mem => mem.UserId == creatorUserId)!.LastReadMessageId ?? 0),
                                    cancellationToken);

                return new ChatRoomDto(
                    existingRoom.Id,
                    otherUser?.UserName ?? existingRoom.Name, // Name of the room for creator is the other user's name
                    existingRoom.Description,
                    existingRoom.IsGroup,
                    otherUser?.Avatar, // Avatar of the other user
                    existingRoom.Created,
                    await _context.ChatMessages.CountAsync(m => m.ChatRoomId == existingRoom.Id, cancellationToken),
                    lastMessage?.Content.Length > 50 ? lastMessage.Content.Substring(0, 50) + "..." : lastMessage?.Content,
                    lastMessage?.Created,
                    lastMessage?.Sender?.UserName,
                    unreadCount
                );
            }
        }

        var chatRoom = new ChatRoom
        {
            Name = request.Name,
            Description = request.Description,
            IsGroup = request.IsGroup,
            CreatedById = creatorUserId,
            RegionId = request.IsSupportRoom ? request.RegionId : activeRegionId, // Use active region for non-support rooms
            IsSupportRoom = request.IsSupportRoom,
        };

        _context.ChatRooms.Add(chatRoom);
        await _context.SaveChangesAsync(cancellationToken);

        var memberIdsToNotify = new List<string>();

        if (!string.IsNullOrEmpty(creatorUserId))
        {
            var creatorMember = new ChatRoomMember
            {
                UserId = creatorUserId,
                ChatRoomId = chatRoom.Id,
                Role = ChatRole.Owner
            };
            _context.ChatRoomMembers.Add(creatorMember);
        }

        //if (!string.IsNullOrEmpty(creatorUserId))
        //{
        //    var creatorMember = new ChatRoomMember
        //    {
        //        UserId = creatorUserId,
        //        ChatRoomId = chatRoom.Id,
        //        Role = ChatRole.Owner // Or Member for private chats if no owner concept
        //    };
        //    _context.ChatRoomMembers.Add(creatorMember);
        //}

        if (request.MemberIds != null)
        {
            foreach (var memberId in request.MemberIds)
            {
                if (memberId == creatorUserId && !request.IsGroup) continue; // Skip self if it's a private chat

                var userExists = await _context.Users.AnyAsync(u => u.Id == memberId, cancellationToken);
                if (!userExists)
                {
                    // Log or handle missing user
                    continue;
                }

                var member = new ChatRoomMember
                {
                    UserId = memberId,
                    ChatRoomId = chatRoom.Id,
                    Role = ChatRole.Member
                };
                _context.ChatRoomMembers.Add(member);
                if (memberId != creatorUserId) // Only notify others
                {
                    memberIdsToNotify.Add(memberId);
                }
            }
        }
        await _context.SaveChangesAsync(cancellationToken);


        string finalRoomNameForCreator = request.Name;
        string? finalRoomAvatarForCreator = null;

        if (!chatRoom.IsGroup && request.MemberIds?.Count == 1 && !string.IsNullOrEmpty(creatorUserId))
        {
            var otherMemberId = request.MemberIds.First(id => id != creatorUserId); // Ensure it's the other member
            var otherUser = await _context.Users.FindAsync(new object[] { otherMemberId! }, cancellationToken);
            if (otherUser != null)
            {
                finalRoomNameForCreator = otherUser.UserName ?? request.Name; // Fallback to request.Name if UserName is null
                finalRoomAvatarForCreator = otherUser.Avatar;
            }
        }
        else if (chatRoom.IsGroup)
        {
            finalRoomNameForCreator = chatRoom.Name;
            // finalRoomAvatarForCreator = chatRoom.Avatar; // if groups can have avatars
        }


        var creatorRoomDto = new ChatRoomDto(
            chatRoom.Id,
            finalRoomNameForCreator,
            chatRoom.Description,
            chatRoom.IsGroup,
            finalRoomAvatarForCreator,
            chatRoom.Created,
            0, // Initial message count
            null, null, null, 0
        );

        if (chatRoom.IsGroup)
        {
            foreach (var memberIdToNotify in memberIdsToNotify)
            {
                var targetUser = await _context.Users.FindAsync(new object[] { memberIdToNotify }, cancellationToken);
                if (targetUser == null) continue;

                // For groups, the room name is the group name
                string roomNameForMember = chatRoom.Name;
                string? roomAvatarForMember = chatRoom.Avatar; // Group avatar if exists

                var roomDtoForMember = new ChatRoomDto(
                    chatRoom.Id,
                    roomNameForMember,
                    chatRoom.Description,
                    chatRoom.IsGroup,
                    roomAvatarForMember,
                    chatRoom.Created,
                    0,
                    null, null, null, 0
                );
                await _chatHubService.SendChatRoomUpdateToUser(memberIdToNotify, roomDtoForMember);
            }
        }


        return creatorRoomDto;
    }
}
