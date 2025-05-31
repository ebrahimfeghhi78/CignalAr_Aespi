using Microsoft.AspNetCore.Identity;

namespace LawyerProject.Domain.Entities;

public partial class User: IdentityUser
{
    public string FirstName { get; set; } = null!;

    public string LastName { get; set; } = null!;

    public string? Avatar { get; set; }

    public string? NationalCode { get; set; } = null!;

    public DateTime Created { get; set; } = DateTime.Now;

    public string? CreatedBy { get; set; }

    public DateTime LastModified { get; set; } = DateTime.Now;

    public string? LastModifiedBy { get; set; }
    public string? PasswordResetCode { get; set; }
    public DateTime? PasswordResetCodeExpiry { get; set; }
    public bool IsActive { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? RefreshTokenExpiryTime { get; set; }
    public int TokenVersion { get; set; }
    public bool IsDelete { get; set; }
    public virtual ICollection<CaseParticipant> CaseParticipants { get; set; } = new List<CaseParticipant>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual ICollection<RegionsUser> RegionsUsers { get; set; } = new List<RegionsUser>();

    public virtual ICollection<SupportTicket> SupportTickets { get; set; } = new List<SupportTicket>();

    public virtual ICollection<TicketReply> TicketReplies { get; set; } = new List<TicketReply>();
    public virtual ICollection<Fcm> Fcms { get; set; } = new List<Fcm>();
    public virtual ICollection<EncryptedFileMetadata> UploadedFiles { get; set; } = new List<EncryptedFileMetadata>();
    public virtual ICollection<UserPreference> UserPreferences { get; set; } = new List<UserPreference>();
}
