using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;

namespace LawyerProject.Application.Chats.Queries;

public record GetChatMessagesQuery(
    int ChatRoomId,
    int Page = 1,
    int PageSize = 50
) : IRequest<List<ChatMessageDto>>;

public class GetChatMessagesQueryHandler : IRequestHandler<GetChatMessagesQuery, List<ChatMessageDto>>
{
    private readonly IApplicationDbContext _context;

    public GetChatMessagesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ChatMessageDto>> Handle(GetChatMessagesQuery request, CancellationToken cancellationToken)
    {
        var messages = await _context.ChatMessages
            .Where(m => m.ChatRoomId == request.ChatRoomId && !m.IsDeleted)
            .Include(m => m.Sender)
            .OrderByDescending(m => m.Created)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(m => new ChatMessageDto(
                m.Id,
                m.Content,
                m.SenderId,
                m.Sender.UserName!,
                m.Sender.Avatar,
                m.ChatRoomId,
                m.Type,
                m.AttachmentUrl,
                m.ReplyToMessageId,
                m.Created,
                m.IsEdited,
                m.EditedAt
            ))
            .ToListAsync(cancellationToken);

        return messages.OrderBy(m => m.CreatedAt).ToList();
    }
}
