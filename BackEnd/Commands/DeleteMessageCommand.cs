// File: BackEnd/Commands/DeleteMessageCommand.cs
using LawyerProject.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace LawyerProject.Application.Chats.Commands;

public record DeleteMessageCommand(int MessageId) : IRequest<bool>; // Returns true if successful

public class DeleteMessageCommandHandler : IRequestHandler<DeleteMessageCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly IChatHubService _chatHubService;

    public DeleteMessageCommandHandler(IApplicationDbContext context, IUser user, IChatHubService chatHubService)
    {
        _context = context;
        _user = user;
        _chatHubService = chatHubService;
    }

    public async Task<bool> Handle(DeleteMessageCommand request, CancellationToken cancellationToken)
    {
        var userId = _user.Id;
        var message = await _context.ChatMessages.FindAsync(request.MessageId);

        if (message == null)
        {
            throw new KeyNotFoundException("Message not found.");
        }

        if (message.SenderId != userId)
        {
            throw new UnauthorizedAccessException("You can only delete your own messages.");
        }

        // Soft delete: mark as deleted and clear sensitive content if needed
        message.IsDeleted = true; // Assuming IsDeleted is a boolean flag in ChatMessage entity
        message.Content = "[پیام حذف شد]"; // Optional: change content
        // message.AttachmentUrl = null; // Optional: remove attachment link

        await _context.SaveChangesAsync(cancellationToken);

        // Notify clients that message is deleted
        // Send enough info for client to identify and update/remove the message
        await _chatHubService.SendMessageUpdateToRoom(message.ChatRoomId.ToString(), new { MessageId = message.Id, ChatRoomId = message.ChatRoomId, IsDeleted = true }, "MessageDeleted");

        return true;
    }
}
