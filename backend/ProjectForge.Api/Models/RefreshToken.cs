namespace ProjectForge.Api.Models;

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SessionId { get; set; }

    public RefreshSession Session { get; set; } = null!;

    public string TokenHash { get; set; } = "";

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UsedAtUtc { get; set; }

    public Guid Version { get; set; } = Guid.NewGuid();
}