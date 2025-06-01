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
        chatApi.MapGet("/users/online", async (IApplicationDbContext context, IUser user) => // Added IUser
        {
            var currentUserId = user.Id; // Get current user's Id
            var onlineUsers = await context.UserConnections
                .Where(c => c.IsActive && c.UserId != currentUserId) // <--- Filter out current user
                .Include(c => c.User)
                .Select(c => new
                {
                    c.User.Id,
                    c.User.UserName, // Make sure UserName is not null
                    c.User.Avatar,
                })
                .Distinct() // Distinct should already handle duplicates if User.Id is the same.
                .ToListAsync();

            return Results.Ok(onlineUsers);
        });

        // Search users for adding to chat
        chatApi.MapGet("/users/search", async (
            string query,
            IApplicationDbContext context,
            IUser currentUser) => // Inject IUser
        {
            var activeRegionId = currentUser.RegionId;

            var currentUserId = currentUser.Id;

            var users = await context.Users
                .Where(u => u.Id != currentUserId) // Exclude self from search results
                .Where(u => u.RegionsUsers.Any(ru => ru.RegionId == activeRegionId)) // User must be in the active region
                .Where(u => u.UserName!.Contains(query) || u.Email!.Contains(query) || (u.FirstName + " " + u.LastName).Contains(query)) // Search by UserName, Email, or FullName
                .Select(u => new
                {
                    u.Id,
                    UserName = u.UserName, // Ensure UserName is consistently used
                    FullName = u.FirstName + " " + u.LastName,
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
        });

        // Edit message
        chatApi.MapPut("/messages/{messageId:int}", async (
            int messageId,
            EditMessageRequest request,
            IMediator mediator) =>
        {
            var command = new EditMessageCommand(messageId, request.NewContent);
            var result = await mediator.Send(command);
            return Results.Ok(result);
        }).WithName("EditChatMessage"); // Add name for easier reference

        // Delete message
        chatApi.MapDelete("/messages/{messageId:int}", async (
            int messageId,
            IMediator mediator) =>
        {
            var command = new DeleteMessageCommand(messageId);
            await mediator.Send(command);
            return Results.Ok(new { MessageId = messageId, Status = "Deleted" });
        }).WithName("DeleteChatMessage");

        chatApi.MapPost("/messages/{messageId:int}/react", async (
            int messageId,
            ReactRequest requestBody, // Define ReactRequest below
            IMediator mediator) =>
        {
            var command = new ReactToMessageCommand(messageId, requestBody.Emoji);
            var result = await mediator.Send(command);
            return Results.Ok(result); // Returns MessageReactionDto
        }).WithName("ReactToChatMessage");

        chatApi.MapPost("/messages/forward", async (
            ForwardMessageRequest requestBody, // Define ForwardMessageRequest below
            IMediator mediator) =>
        {
            var command = new ForwardMessageCommand(requestBody.OriginalMessageId, requestBody.TargetChatRoomId);
            var result = await mediator.Send(command);
            return Results.Ok(result); // Returns the DTO of the new forwarded message
        }).WithName("ForwardChatMessage");
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

    public record EditMessageRequest(string NewContent);

    public record ReactRequest(string Emoji);

    public record ForwardMessageRequest(int OriginalMessageId, int TargetChatRoomId);
}
