using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    // "DbSet<WorkItem>" provides access to work-item records.
    public DbSet<WorkItem> WorkItems => Set<WorkItem>();

    public DbSet<RefreshSession> RefreshSessions =>
           Set<RefreshSession>();

    public DbSet<RefreshToken> RefreshTokens =>
        Set<RefreshToken>();

    // "OnModelCreating" configures their database mapping.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var item = modelBuilder.Entity<WorkItem>();

        // "HasKey" specifies the primary key.
        item.HasKey(x => x.Id);

        item.Property(x => x.Title)
            .HasMaxLength(120)
            .IsRequired();

        item.Property(x => x.Description)
            .HasMaxLength(4000)
            .IsRequired();

        // "IsConcurrencyToken" enables version checking during writes.
        item.Property(x => x.Version)
            .IsConcurrencyToken();

        // "HasIndex" creates an index for status and creation time.
        item.HasOne(x => x.Owner)
            .WithMany()
            .HasForeignKey(x => x.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        item.HasIndex(x => new
        {
            x.OwnerId,
            x.Status,
            x.CreatedAt
        });
        // Login sessions.
        var session = modelBuilder.Entity<RefreshSession>();

        session.HasKey(x => x.Id);

        session.Property(x => x.SecurityStamp)
            .HasMaxLength(256)
            .IsRequired();

        session.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Individual refresh-token credentials.
        var token = modelBuilder.Entity<RefreshToken>();

        token.HasKey(x => x.Id);

        token.Property(x => x.TokenHash)
            .HasMaxLength(64)
            .IsRequired();

        token.HasIndex(x => x.TokenHash)
            .IsUnique();

        token.Property(x => x.Version)
            .IsConcurrencyToken();

        token.HasOne(x => x.Session)
            .WithMany()
            .HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}