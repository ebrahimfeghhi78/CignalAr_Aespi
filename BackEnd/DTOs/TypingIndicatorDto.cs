namespace LawyerProject.Application.Chats.DTOs;

public record TypingIndicatorDto(
    string? UserId,
    string UserName,
    int ChatRoomId,
    bool IsTyping
);
