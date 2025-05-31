namespace LawyerProject.Application.Chats.DTOs;

public record ChatRoomDto(
    int Id,
    string Name,
    string? Description,
    bool IsGroup,
    string? Avatar,
    DateTime CreatedAt,
    int MessageCount,
    string? LastMessageContent,
    DateTime? LastMessageTime,
    string? LastMessageSenderName,
    int UnreadCount
);
