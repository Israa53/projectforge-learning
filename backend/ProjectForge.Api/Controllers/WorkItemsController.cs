using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Controllers;

[ApiController]
[Route("api/work-items")] // "Route" sets the controller’s base URL
public class WorkItemsController : ControllerBase
{
    // Constructor parameter "AppDbContext db" indicates that ASP.NET injects the registered database context.
    private readonly AppDbContext _db;

    public WorkItemsController(AppDbContext db)
    {
        _db = db;
    }
    // POST: api/workitems
    [HttpPost]
    [ProducesResponseType(typeof(WorkItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(
        typeof(ValidationProblemDetails),
        StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<WorkItemDto>> Create(
        // "[FromBody]" checks that request JSON is deserialized into the input DTO.
        [FromBody] WorkItemInput input,
        CancellationToken cancellationToken)
    // "CancellationToken" allows the request to be cancelled, for example if the client disconnects.

    {
        var item = new WorkItem
        {
            Title = input.Title.Trim(),
            Description = input.Description.Trim(),
            Status = input.Status,
            Priority = input.Priority,
            DueDate = input.DueDate
        };

        // "Add(item)" starts tracking a new entity; it doesn’t save yet
        _db.WorkItems.Add(item);

        // "SaveChangesAsync(...)" writes all tracked changes to the database.
        await _db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetById),
            new { id = item.Id },
            WorkItemDto.From(item)
        );
    }
    // GET: api/workitems
    [HttpGet]
    public async Task<ActionResult<PagedResult<WorkItemDto>>> GetAll(
     [FromQuery] ListQuery input,
     CancellationToken cancellationToken)
    {
        var query = _db.WorkItems.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(input.Search))
        {
            var search = input.Search.Trim().ToLower();

            // "Where" filters the query based on the search criteria
            query = query.Where(item =>
                item.Title.ToLower().Contains(search) ||
                item.Description.ToLower().Contains(search)
            );
        }

        if (input.Status is not null)
        {
            query = query.Where(item => item.Status == input.Status);
        }

        // "CountAsync" gets the total number of items matching the query
        var totalCount = await query.CountAsync(cancellationToken);

        // "OrderByDescending" sorts the items by creation date in descending order
        // "ThenBy" sorts the items by ID in ascending order
        // "Skip" skips the number of items based on the current page and page size
        // "Take" implements pagination by taking the specified number of items
        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Skip((input.Page - 1) * input.PageSize)
            .Take(input.PageSize)
            .ToListAsync(cancellationToken);

        var response = new PagedResult<WorkItemDto>(
            items.Select(WorkItemDto.From).ToList(),
            totalCount,
            input.Page,
            input.PageSize
        );

        return Ok(response);
    }
    // GET: api/workitems/{id}
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(WorkItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<WorkItemDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var item = await _db.WorkItems
            .AsNoTracking() // "AsNoTracking" reads entities without tracking them for updates
            .SingleOrDefaultAsync(
                item => item.Id == id,
                cancellationToken
            );

        if (item is null)
        {
            return NotFound();
        }

        return Ok(WorkItemDto.From(item));
    }
    // PUT: api/workitems/{id}
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(WorkItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(
    typeof(ValidationProblemDetails),
    StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(
    typeof(ProblemDetails),
    StatusCodes.Status409Conflict)]
    public async Task<ActionResult<WorkItemDto>> Update(
    Guid id,
    [FromBody] UpdateWorkItemInput input,
    CancellationToken cancellationToken)
    {
        var item = await _db.WorkItems
            .SingleOrDefaultAsync(
                item => item.Id == id,
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

    // DELETE: api/workitems/{id}
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(
        typeof(ProblemDetails),
        StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(
        typeof(ProblemDetails),
        StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromQuery] Guid? version,
        CancellationToken cancellationToken)
    {
        if (version is null)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Version is required",
                detail: "Provide the item's current version in the query string."
            );
        }

        var item = await _db.WorkItems
            .SingleOrDefaultAsync(
                item => item.Id == id,
                cancellationToken
            );

        if (item is null)
        {
            return NotFound();
        }

        if (item.Version != version)
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

        return NoContent();
    }

    private ObjectResult VersionConflict()
    {
        return Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "This item changed",
            detail: "Reload the latest item before editing or deleting it."
        );
    }

}