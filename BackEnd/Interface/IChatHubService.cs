using LawyerProject.Application.Chats.DTOs;

namespace LawyerProject.Application.Common.Interfaces;

public interface IChatHubService
{
    Task SendMessageToRoom(string roomId, ChatMessageDto message);
    Task SendTypingIndicator(string roomId, TypingIndicatorDto indicator);
    Task NotifyUserOnline(Guid userId, bool isOnline);
    Task SendChatRoomUpdateToUser(string userId, ChatRoomDto roomDetails);
    Task SendMessageUpdateToRoom(string roomId, object payload, string eventName = "MessageUpdated"); 
}
