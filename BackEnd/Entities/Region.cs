using LawyerProject.Domain.Entities.BankEntities;

namespace LawyerProject.Domain.Entities;

public partial class Region : BaseAuditableEntity
{

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    public string? PhoneNumber { get; set; }

    public string? Email { get; set; }

    public string? DomainUrl { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<Case> Cases { get; set; } = new List<Case>();

    public virtual ICollection<PackageSubscription> PackageSubscriptions { get; set; } = new List<PackageSubscription>();

    public virtual ICollection<Payment> Payments { get; set; } = new List<Payment>();

    public virtual ICollection<RegionsUser> RegionsUsers { get; set; } = new List<RegionsUser>();
    public virtual ICollection<UsersRole> UsersRoles { get; set; } = new List<UsersRole>();
    public virtual ICollection<Wallet> Wallets { get; set; } = new List<Wallet>();
    public virtual ICollection<BankBranch> BankBranchs { get; set; } = new List<BankBranch>();
    public virtual ICollection<EncryptedFileMetadata> Files { get; set; } = new List<EncryptedFileMetadata>();
    public virtual ICollection<UserPreference> UserPreferences { get; set; } = new List<UserPreference>();
}
