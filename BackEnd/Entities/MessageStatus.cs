using System.Xml;

namespace LawyerProject.Domain.Entities;

public class MessageStatus:BaseAuditableEntity
{
    public int MessageId { get; set; }
    public string? UserId { get; set; }
    public ReadStatus Status { get; set; }
    public DateTime StatusAt { get; set; }

    public virtual ChatMessage Message { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
