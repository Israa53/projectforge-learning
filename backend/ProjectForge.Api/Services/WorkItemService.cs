using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Services;

public sealed class WorkItemService(AppDbContext db)
{
    // All reads, updates, and deletes start with ownership.
    private IQueryable<WorkItem> OwnedItems(string userId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);

        return db.WorkItems.Where(
            item => item.OwnerId == userId
        );
    }

    public async Task<PagedResult<WorkItemDto>> GetAllAsync(
        string userId,
        ListQuery input,
        CancellationToken ct)
    {
        var query = OwnedItems(userId).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(input.Search))
        {
            var search = input.Search.Trim().ToLower();

            query = query.Where(item =>
                item.Title.ToLower().Contains(search) ||
                item.Description.ToLower().Contains(search)
            );
        }

        if (input.Status is not null)
        {
            query = query.Where(
                item => item.Status == input.Status
            );
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Skip((input.Page - 1) * input.PageSize)
            .Take(input.PageSize)
            .ToListAsync(ct);

        return new PagedResult<WorkItemDto>(
            items.Select(WorkItemDto.From).ToList(),
            totalCount,
            input.Page,
            input.PageSize
        );
    }

    public async Task<WorkItemDto?> GetByIdAsync(
        string userId,
        Guid id,
        CancellationToken ct)
    {
        var item = await OwnedItems(userId)
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.Id == id,
                ct
            );

        return item is null
            ? null
            : WorkItemDto.From(item);
    }

    public async Task<WorkItemDto> CreateAsync(
        string userId,
        WorkItemInput input,
        CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId);

        var item = new WorkItem
        {
            OwnerId = userId
        };

        ApplyInput(item, input);

        db.WorkItems.Add(item);

        await db.SaveChangesAsync(ct);

        return WorkItemDto.From(item);
    }

    public async Task<WorkItemWriteResult> UpdateAsync(
        string userId,
        Guid id,
        UpdateWorkItemInput input,
        CancellationToken ct)
    {
        var item = await OwnedItems(userId)
            .SingleOrDefaultAsync(
                item => item.Id == id,
                ct
            );

        if (item is null)
        {
            return new(
                WorkItemWriteStatus.NotFound
            );
        }

        if (item.Version != input.Version)
        {
            return new(
                WorkItemWriteStatus.VersionConflict
            );
        }

        ApplyInput(item, input);

        item.UpdatedAt = DateTime.UtcNow;
        item.Version = Guid.NewGuid();

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Remove the unsuccessful write from tracking.
            db.Entry(item).State = EntityState.Detached;

            return new(
                WorkItemWriteStatus.VersionConflict
            );
        }

        return new(
            WorkItemWriteStatus.Success,
            WorkItemDto.From(item)
        );
    }

    public async Task<WorkItemWriteStatus> DeleteAsync(
        string userId,
        Guid id,
        Guid version,
        CancellationToken ct)
    {
        var item = await OwnedItems(userId)
            .SingleOrDefaultAsync(
                item => item.Id == id,
                ct
            );

        if (item is null)
        {
            return WorkItemWriteStatus.NotFound;
        }

        if (item.Version != version)
        {
            return WorkItemWriteStatus.VersionConflict;
        }

        db.WorkItems.Remove(item);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            db.Entry(item).State = EntityState.Detached;

            return WorkItemWriteStatus.VersionConflict;
        }

        return WorkItemWriteStatus.Success;
    }

    private static void ApplyInput(
        WorkItem item,
        WorkItemInput input)
    {
        item.Title = input.Title.Trim();
        item.Description = input.Description.Trim();
        item.Status = input.Status;
        item.Priority = input.Priority;
        item.DueDate = input.DueDate;
    }
}