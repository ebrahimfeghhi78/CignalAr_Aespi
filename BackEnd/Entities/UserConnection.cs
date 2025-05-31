namespace LawyerProject.Domain.Entities;

public class UserConnection:BaseAuditableEntity
{
    public string? UserId { get; set; }
    public string ConnectionId { get; set; } = string.Empty;
    public DateTime ConnectedAt { get; set; }
    public bool IsActive { get; set; }

    public virtual User User { get; set; } = null!;
}
