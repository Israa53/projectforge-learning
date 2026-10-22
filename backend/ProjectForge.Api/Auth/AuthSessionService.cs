using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Auth;

// Internal service result: the raw refresh token goes only to an HttpOnly cookie.
public record SessionTokens(
    AuthResponse Response,
    string RefreshToken,
    DateTime RefreshExpiresAtUtc
);

public class AuthSessionService(
    AppDbContext db,
    UserManager<ApplicationUser> users,
    TokenIssuer issuer)
{
    private static string GenerateToken() =>
        WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(64));

    private static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public async Task<SessionTokens> StartAsync(
        ApplicationUser user,
        CancellationToken ct)
    {
        var session = new RefreshSession
        {
            UserId = user.Id,
            SecurityStamp = user.SecurityStamp ?? "",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
        };

        var rawToken = GenerateToken();
        db.RefreshSessions.Add(session);
        db.RefreshTokens.Add(new RefreshToken
        {
            SessionId = session.Id,
            TokenHash = Hash(rawToken)
        });

        await db.SaveChangesAsync(ct);

        return new SessionTokens(
            issuer.Create(user, session.Id),
            rawToken,
            session.ExpiresAtUtc
        );
    }

    public async Task<SessionTokens?> RotateAsync(
        string rawToken,
        CancellationToken ct)
    {
        // The SQLite transaction serializes competing refresh writes.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var hash = Hash(rawToken);
        var token = await db.RefreshTokens
            .Include(x => x.Session)
            .ThenInclude(x => x.User)
            .SingleOrDefaultAsync(x => x.TokenHash == hash, ct);

        if (token is null) return null;

        var session = token.Session;
        var now = DateTime.UtcNow;

        if (session.RevokedAtUtc is not null || session.ExpiresAtUtc <= now)
            return null;

        var accountChanged = !string.Equals(
            session.SecurityStamp,
            session.User.SecurityStamp,
            StringComparison.Ordinal
        );

        if (token.UsedAtUtc is not null || accountChanged ||
            await users.IsLockedOutAsync(session.User))
        {
            // Reuse invalidates the entire login session, including its newer token.
            session.RevokedAtUtc = now;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return null;
        }

        var replacement = GenerateToken();
        token.UsedAtUtc = now;
        token.Version = Guid.NewGuid();

        db.RefreshTokens.Add(new RefreshToken
        {
            SessionId = session.Id,
            TokenHash = Hash(replacement)
        });

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(ct);
            db.ChangeTracker.Clear();

            await db.RefreshSessions
                .Where(x => x.Id == session.Id && x.RevokedAtUtc == null)
                .ExecuteUpdateAsync(update => update.SetProperty(
                    x => x.RevokedAtUtc, (DateTime?)now), ct);

            return null;
        }

        return new SessionTokens(
            issuer.Create(session.User, session.Id),
            replacement,
            session.ExpiresAtUtc
        );
    }

    public async Task RevokeAsync(string rawToken, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var hash = Hash(rawToken);
        var token = await db.RefreshTokens
            .Include(x => x.Session)
            .SingleOrDefaultAsync(x => x.TokenHash == hash, ct);

        if (token is not null && token.Session.RevokedAtUtc is null)
        {
            token.Session.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        await transaction.CommitAsync(ct);
    }
}
