namespace LawyerProject.Domain.Entities;

public class MessageReaction : BaseAuditableEntity
{
    public int MessageId { get; set; }
    public string? UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;

    public virtual ChatMessage Message { get; set; } = null!;
    public virtual User User { get; set; } = null!;
}
