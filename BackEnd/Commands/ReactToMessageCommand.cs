using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LawyerProject.Application.Chats.Commands;

// DTO for the reaction data sent from client and broadcasted
public record MessageReactionDto(int MessageId, string UserId, string UserName, string Emoji, int ChatRoomId);

public record ReactToMessageCommand(int MessageId, string Emoji) : IRequest<MessageReactionDto>;

public class ReactToMessageCommandHandler : IRequestHandler<ReactToMessageCommand, MessageReactionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly IChatHubService _chatHubService;

    public ReactToMessageCommandHandler(IApplicationDbContext context, IUser user, IChatHubService chatHubService)
    {
        _context = context;
        _user = user;
        _chatHubService = chatHubService;
    }

    public async Task<MessageReactionDto> Handle(ReactToMessageCommand request, CancellationToken cancellationToken)
    {
        var userId = _user.Id;
        var userEntity = await _context.Users.FindAsync(userId);
        if (userEntity == null)
        {
            throw new UnauthorizedAccessException("User not found.");
        }

        var message = await _context.ChatMessages.FindAsync(request.MessageId);
        if (message == null)
        {
            throw new KeyNotFoundException("Message not found.");
        }

        var existingReaction = await _context.MessageReactions
            .FirstOrDefaultAsync(r => r.MessageId == request.MessageId && r.UserId == userId && r.Emoji == request.Emoji, cancellationToken);

        if (existingReaction != null)
        {
            // User is removing this specific reaction
            _context.MessageReactions.Remove(existingReaction);
        }
        else
        {
            var anyExistingReactionFromUser = await _context.MessageReactions
               .FirstOrDefaultAsync(r => r.MessageId == request.MessageId && r.UserId == userId, cancellationToken);
            if (anyExistingReactionFromUser != null) _context.MessageReactions.Remove(anyExistingReactionFromUser);

            var newReaction = new MessageReaction
            {
                MessageId = request.MessageId,
                UserId = userId,
                Emoji = request.Emoji
            };
            _context.MessageReactions.Add(newReaction);
        }

        await _context.SaveChangesAsync(cancellationToken);

        var reactionDto = new MessageReactionDto(request.MessageId, userId!, userEntity.UserName!, request.Emoji, message.ChatRoomId);

        // Broadcast the reaction event
        await _chatHubService.SendMessageUpdateToRoom(message.ChatRoomId.ToString(), reactionDto, "MessageReacted");

        return reactionDto;
    }
}
