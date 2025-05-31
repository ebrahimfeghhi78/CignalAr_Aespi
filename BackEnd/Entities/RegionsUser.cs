namespace LawyerProject.Domain.Entities;

public partial class RegionsUser : BaseAuditableEntity
{

    public int? RegionId { get; set; }

    public string? UserId { get; set; }

    public virtual Region? Region { get; set; }

    public virtual User? User { get; set; }

}
