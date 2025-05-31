using System.Security.Claims;
using LawyerProject.Application.Chats.Commands;
using LawyerProject.Application.Chats.Queries;
using LawyerProject.Application.Common.Interfaces;
using LawyerProject.Domain.Entities;
using LawyerProject.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace LawyerProject.Web.Endpoints;

public class Chat : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        // Changed from RequireAuthorization() to AllowAnonymous()
        var chatApi = app.MapGroup("/api/chat").RequireAuthorization(); ;

        // Get user's chat rooms
        chatApi.MapGet("/rooms", async (IMediator mediator) =>
        {
            var query = new GetChatRoomsQuery();
            var result = await mediator.Send(query);
            return Results.Ok(result);
        });

        // Get messages for a chat room
        chatApi.MapGet("/rooms/{roomId:int}/messages", async (
            int roomId,
            int page,
            int pageSize,
            IMediator mediator) =>
        {
            var query = new GetChatMessagesQuery(roomId, page, pageSize);
            var result = await mediator.Send(query);
            return Results.Ok(result);
        });

        // Create new chat room
        chatApi.MapPost("/rooms", async (
            CreateChatRoomRequest request,
            IMediator mediator) =>
        {
            var command = new CreateChatRoomCommand(
                request.Name,
                request.Description,
                request.IsGroup,
                request.MemberIds,
                request.RegionId
            );
            var result = await mediator.Send(command);
            return Results.Created($"/api/chat/rooms/{result.Id}", result);
        });

        // Send message
        chatApi.MapPost("/rooms/{roomId:int}/messages", async (
            int roomId,
            SendMessageRequest request,
            IMediator mediator) =>
        {
            var command = new SendMessageCommand(
                roomId,
                request.Content,
                request.Type,
                request.AttachmentUrl,
                request.ReplyToMessageId
            );
            var result = await mediator.Send(command);
            return Results.Created($"/api/chat/messages/{result.Id}", result);
        });

        // Join chat room
        chatApi.MapPost("/rooms/{roomId:int}/join", async (
            int roomId,
            IApplicationDbContext context,
            HttpContext httpContext,
            IUser user) =>
        {
            var userId = user.Id;

            var existingMember = await context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.UserId == userId && m.ChatRoomId == roomId);

            if (existingMember != null)
                return Results.BadRequest("Already a member");

            var member = new ChatRoomMember
            {
                UserId = userId,
                ChatRoomId = roomId,
                Role = ChatRole.Member
            };

            context.ChatRoomMembers.Add(member);
            await context.SaveChangesAsync(CancellationToken.None);

            return Results.Ok();
        });

        // Leave chat room
        chatApi.MapDelete("/rooms/{roomId:int}/leave", async (
            int roomId,
            IApplicationDbContext context,
            HttpContext httpContext,
            IUser user) =>
        {
            var userId = user.Id;

            var member = await context.ChatRoomMembers
                .FirstOrDefaultAsync(m => m.UserId == userId && m.ChatRoomId == roomId);

            if (member == null)
                return Results.NotFound();

            context.ChatRoomMembers.Remove(member);
            await context.SaveChangesAsync(CancellationToken.None);

            return Results.Ok();
        });

        // Get online users
        chatApi.MapGet("/users/online", async (IApplicationDbContext context) =>
        {
            var onlineUsers = await context.UserConnections
                .Where(c => c.IsActive)
                .Include(c => c.User)
                .Select(c => new
                {
                    c.User.Id,
                    c.User.UserName,
                    c.User.Avatar,
                    c.ConnectedAt
                })
                .Distinct()
                .ToListAsync();

            return Results.Ok(onlineUsers);
        });

        // Search users for adding to chat
        chatApi.MapGet("/users/search", async (
            string query,
            IApplicationDbContext context) =>
        {
            var users = await context.Users
                .Where(u => u.UserName!.Contains(query) || u.Email!.Contains(query))
                .Select(u => new
                {
                    u.Id,
                    u.UserName,
                    u.Email,
                    u.Avatar
                })
                .Take(20)
                .ToListAsync();

            return Results.Ok(users);
        });

        // Get chat room members
        chatApi.MapGet("/rooms/{roomId:int}/members", async (
            int roomId,
            IApplicationDbContext context) =>
        {
            var members = await context.ChatRoomMembers
                .Where(m => m.ChatRoomId == roomId)
                .Include(m => m.User)
                .Select(m => new
                {
                    m.User.Id,
                    m.User.UserName,
                    m.User.Avatar,
                    m.Role,
                    m.JoinedAt,
                    m.LastSeenAt
                })
                .ToListAsync();

            return Results.Ok(members);
        })
        ;
    }

    // Request DTOs remain unchanged
    public record CreateChatRoomRequest(
        string Name,
        string? Description,
        bool IsGroup,
        List<string>? MemberIds = null,
        int? RegionId = null
    );

    public record SendMessageRequest(
        string Content,
        MessageType Type = MessageType.Text,
        string? AttachmentUrl = null,
        int? ReplyToMessageId = null
    );
}
