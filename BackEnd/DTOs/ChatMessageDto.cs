using LawyerProject.Domain.Enums;

namespace LawyerProject.Application.Chats.DTOs;

public record ChatMessageDto(
    int Id,
    string Content,
    string? SenderId,
    string SenderName,
    string? SenderAvatar,
    int ChatRoomId,
    MessageType Type,
    string? AttachmentUrl,
    int? ReplyToMessageId,
    DateTime CreatedAt,
    bool IsEdited,
    DateTime? EditedAt
);
