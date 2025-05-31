namespace LawyerProject.Domain.Entities;

public class ChatRoom:BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsGroup { get; set; }
    public string? Avatar { get; set; }
    public int? RegionId { get; set; }
    public string? CreatedById { get; set; }
    public bool IsSupportRoom { get; set; }
    public string? GuestIdentifier { get; set; }

    public virtual Region? Region { get; set; }
    public new virtual User CreatedBy { get; set; } = null!;
    public virtual ICollection<ChatRoomMember> Members { get; set; } = new List<ChatRoomMember>();
    public virtual ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
