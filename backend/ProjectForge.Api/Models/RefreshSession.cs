namespace ProjectForge.Api.Models;

public class RefreshSession
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string UserId { get; set; } = "";

    public ApplicationUser User { get; set; } = null!;

    public string SecurityStamp { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAtUtc { get; set; }

    public DateTime? RevokedAtUtc { get; set; }
}