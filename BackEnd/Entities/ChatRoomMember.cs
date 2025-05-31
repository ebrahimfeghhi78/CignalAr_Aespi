namespace LawyerProject.Domain.Entities;

public class ChatRoomMember:BaseAuditableEntity
{
    public string? UserId { get; set; }
    public int ChatRoomId { get; set; }
    public ChatRole Role { get; set; } = ChatRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSeenAt { get; set; }
    public bool IsMuted { get; set; }
    public int? LastReadMessageId { get; set; }

    public virtual User User { get; set; } = null!;
    public virtual ChatRoom ChatRoom { get; set; } = null!;
}
