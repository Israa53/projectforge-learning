using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Controllers;

[ApiController]
[Route("api/work-items")]
[Authorize]
public class WorkItemsController : ControllerBase
{
    private readonly AppDbContext _db;

    // ASP.NET Core injects the registered database context into the controller.
    public WorkItemsController(AppDbContext db)
    {
        _db = db;
    }

    // MapInboundClaims is false in our JWT configuration,
    // so the user ID is available under the original "sub" claim.
    private string? CurrentUserId =>
        User.FindFirstValue("sub");

    // POST: api/work-items
    [HttpPost]
    public async Task<ActionResult<WorkItemDto>> Create(
        // Bind the JSON request body to the work-item input DTO.
        [FromBody] WorkItemInput input,
        // Allows database work to stop if the client disconnects.
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var item = new WorkItem
        {
            OwnerId = userId,
            Title = input.Title.Trim(),
            Description = input.Description.Trim(),
            Status = input.Status,
            Priority = input.Priority,
            DueDate = input.DueDate
        };

        // Add starts tracking the new entity; SaveChangesAsync persists it.
        _db.WorkItems.Add(item);

        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = item.Id },
            WorkItemDto.From(item)
        );
    }

    // GET: api/work-items
    [HttpGet]
    public async Task<ActionResult<PagedResult<WorkItemDto>>> GetAll(
        [FromQuery] ListQuery input,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        // Apply ownership before search, counting, or pagination.
        var query = _db.WorkItems
            .AsNoTracking()
            .Where(item => item.OwnerId == userId);

        // Filter by the search term when one was provided.
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

        // Count matching items before applying pagination.
        var totalCount = await query.CountAsync(
            cancellationToken
        );

        // Sort consistently, then select only the requested page.
        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Skip((input.Page - 1) * input.PageSize)
            .Take(input.PageSize)
            .ToListAsync(cancellationToken);

        return Ok(new PagedResult<WorkItemDto>(
            items.Select(WorkItemDto.From).ToList(),
            totalCount,
            input.Page,
            input.PageSize
        ));
    }

    // GET: api/work-items/{id}
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkItemDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var item = await _db.WorkItems
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item =>
                    item.Id == id &&
                    item.OwnerId == userId,
                cancellationToken
            );

        if (item is null)
        {
            return NotFound();
        }

        return Ok(WorkItemDto.From(item));
    }

    // PUT: api/work-items/{id}
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkItemDto>> Update(
        Guid id,
        [FromBody] UpdateWorkItemInput input,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var item = await _db.WorkItems
            .SingleOrDefaultAsync(
                item =>
                    item.Id == id &&
                    item.OwnerId == userId,
                cancellationToken
            );

        if (item is null)
        {
            return NotFound();
        }

        if (item.Version != input.Version)
        {
            return VersionConflict();
        }

        item.Title = input.Title.Trim();
        item.Description = input.Description.Trim();
        item.Status = input.Status;
        item.Priority = input.Priority;
        item.DueDate = input.DueDate;
        item.UpdatedAt = DateTime.UtcNow;
        item.Version = Guid.NewGuid();

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return VersionConflict();
        }

        return Ok(WorkItemDto.From(item));
    }

    // DELETE: api/work-items/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromQuery] Guid? version,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        if (version is null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Version is required",
                detail:
                    "Provide the item's current version in the query string."
            );
        }

        var item = await _db.WorkItems
            .SingleOrDefaultAsync(
                item =>
                    item.Id == id &&
                    item.OwnerId == userId,
                cancellationToken
            );

        if (item is null)
        {
            return NotFound();
        }

        if (item.Version != version.Value)
        {
            return VersionConflict();
        }

        _db.WorkItems.Remove(item);

        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return VersionConflict();
        }

        // Successful DELETE returns 204 No Content with no response body.
        return NoContent();
    }

    private ObjectResult VersionConflict()
    {
        return Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "This item changed",
            detail:
                "Reload the latest item before editing or deleting it."
        );
    }
}