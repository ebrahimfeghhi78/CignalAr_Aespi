using LawyerProject.Application.Chats.DTOs;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace LawyerProject.Infrastructure.Services;

public class ChatHubService : IChatHubService
{
    private readonly IHubContext<ChatHub> _hubContext;

    public ChatHubService(IHubContext<ChatHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendMessageToRoom(string roomId, ChatMessageDto message)
    {
        await _hubContext.Clients.Group(roomId)
            .SendAsync("ReceiveMessage", message);
    }

    public async Task SendTypingIndicator(string roomId, TypingIndicatorDto indicator)
    {
        await _hubContext.Clients.Group(roomId)
            .SendAsync("UserTyping", indicator);
    }

    public async Task NotifyUserOnline(Guid userId, bool isOnline)
    {
        await _hubContext.Clients.All
            .SendAsync("UserOnlineStatus", new { UserId = userId, IsOnline = isOnline });
    }
    
    public async Task SendChatRoomUpdateToUser(string userId, ChatRoomDto roomDetails)
    {
        await _hubContext.Clients.User(userId)
            .SendAsync("ReceiveChatRoomUpdate", roomDetails);
    }

    public async Task SendMessageUpdateToRoom(string roomId, object payload, string eventName = "MessageUpdated")
    {
        await _hubContext.Clients.Group(roomId).SendAsync(eventName, payload);
    }
}
