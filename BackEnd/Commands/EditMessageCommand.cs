// File: BackEnd/Commands/EditMessageCommand.cs
using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using MediatR; // Make sure MediatR is imported if not already via global usings
using Microsoft.EntityFrameworkCore; // For ToListAsync, FirstOrDefaultAsync etc.

namespace LawyerProject.Application.Chats.Commands;

public record EditMessageCommand(int MessageId, string NewContent) : IRequest<ChatMessageDto>;

public class EditMessageCommandHandler : IRequestHandler<EditMessageCommand, ChatMessageDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly IChatHubService _chatHubService;

    public EditMessageCommandHandler(IApplicationDbContext context, IUser user, IChatHubService chatHubService)
    {
        _context = context;
        _user = user;
        _chatHubService = chatHubService;
    }

    public async Task<ChatMessageDto> Handle(EditMessageCommand request, CancellationToken cancellationToken)
    {
        var userId = _user.Id;
        var message = await _context.ChatMessages
                                .Include(m => m.Sender)
                                .FirstOrDefaultAsync(m => m.Id == request.MessageId, cancellationToken);

        if (message == null)
        {
            throw new KeyNotFoundException("Message not found.");
        }

        if (message.SenderId != userId)
        {
            throw new UnauthorizedAccessException("You can only edit your own messages.");
        }

        message.Content = request.NewContent;
        message.IsEdited = true;
        message.EditedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var messageDto = new ChatMessageDto(
            message.Id,
            message.Content,
            message.SenderId,
            message.Sender.UserName!,
            $"{message.Sender.FirstName} {message.Sender.LastName}",  
            message.Sender.Avatar,
            message.ChatRoomId,
            message.Type,
            message.AttachmentUrl,
            message.ReplyToMessageId,
            message.Created,
            message.IsEdited,
            message.EditedAt,
            null,   
            null,   
            null,   
            new List<ReactionInfo>()  
        );

        await _chatHubService.SendMessageUpdateToRoom(message.ChatRoomId.ToString(), messageDto, "MessageEdited");

        return messageDto;
    }
}
