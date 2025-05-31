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
        string? roomAvatarForCreator = null;

        if (creatorUserId == null && !request.IsSupportRoom)
        {
            throw new UnauthorizedAccessException("User is not authenticated to create a chat room.");
        }

        var chatRoom = new ChatRoom
        {
            Name = request.Name,
            Description = request.Description,
            IsGroup = request.IsGroup,
            CreatedById = creatorUserId,
            RegionId = request.RegionId,
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

        if (request.MemberIds != null)
        {
            foreach (var memberId in request.MemberIds)
            {
                if (memberId == creatorUserId) continue;

                var userExists = await _context.Users.AnyAsync(u => u.Id == memberId, cancellationToken);
                if (!userExists) continue;

                var member = new ChatRoomMember
                {
                    UserId = memberId,
                    ChatRoomId = chatRoom.Id,
                    Role = ChatRole.Member
                };
                _context.ChatRoomMembers.Add(member);
                memberIdsToNotify.Add(memberId);
            }
        }
        await _context.SaveChangesAsync(cancellationToken);

        var creatorRoomDto = new ChatRoomDto(
            chatRoom.Id,
            roomNameForCreator,
            chatRoom.Description,
            chatRoom.IsGroup,
            roomAvatarForCreator,
            chatRoom.Created,
            0,
            null, null, null, 0 
        );

        foreach (var memberIdToNotify in memberIdsToNotify)
        {
            var targetUser = await _context.Users.FindAsync(new object[] { memberIdToNotify }, cancellationToken);
            if (targetUser == null) continue;

            string roomNameForMember = chatRoom.Name; 
            string? roomAvatarForMember = null;

            if (!chatRoom.IsGroup && !string.IsNullOrEmpty(creatorUserId)) 
            {
                // نام روم برای طرف مقابل، نام ایجادکننده است
                var creatorUser = await _context.Users.FindAsync(new object[] { creatorUserId }, cancellationToken);
                roomNameForMember = creatorUser?.UserName ?? chatRoom.Name;
                roomAvatarForMember = creatorUser?.Avatar;
            }
            else if (!chatRoom.IsGroup && request.IsSupportRoom && !string.IsNullOrEmpty(request.GuestFullName))
            {
                roomNameForMember = request.GuestFullName; 
            }


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

        
        if (!chatRoom.IsGroup && request.MemberIds?.Count == 1 && !string.IsNullOrEmpty(creatorUserId))
        {
            var otherMemberId = request.MemberIds.First();
            var otherUser = await _context.Users.FindAsync(new object[] { otherMemberId }, cancellationToken);
            if (otherUser != null)
            {
                creatorRoomDto = creatorRoomDto with { Name = otherUser.UserName!, Avatar = otherUser.Avatar };
            }
        }


        return creatorRoomDto;
    }
}
