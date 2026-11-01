using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Services;

namespace ProjectForge.Api.Controllers;

[ApiController]
[Route("api/work-items")]
[Authorize]
public class WorkItemsController(
    WorkItemService service
) : ControllerBase
{
    private string? CurrentUserId =>
        User.FindFirstValue("sub");

    [HttpGet]
    public async Task<ActionResult<PagedResult<WorkItemDto>>> GetAll(
        [FromQuery] ListQuery input,
        CancellationToken ct)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var result = await service.GetAllAsync(
            userId,
            input,
            ct
        );

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<WorkItemDto>> GetById(
        Guid id,
        CancellationToken ct)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var item = await service.GetByIdAsync(
            userId,
            id,
            ct
        );

        return item is null
            ? NotFound()
            : Ok(item);
    }

    [HttpPost]
    [ProducesResponseType(
        typeof(WorkItemDto),
        StatusCodes.Status201Created)]
    public async Task<ActionResult<WorkItemDto>> Create(
        [FromBody] WorkItemInput input,
        CancellationToken ct)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var item = await service.CreateAsync(
            userId,
            input,
            ct
        );

        return CreatedAtAction(
            nameof(GetById),
            new { id = item.Id },
            item
        );
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkItemDto>> Update(
        Guid id,
        [FromBody] UpdateWorkItemInput input,
        CancellationToken ct)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        var result = await service.UpdateAsync(
            userId,
            id,
            input,
            ct
        );

        return result.Status switch
        {
            WorkItemWriteStatus.Success =>
                Ok(result.Item),

            WorkItemWriteStatus.NotFound =>
                NotFound(),

            WorkItemWriteStatus.VersionConflict =>
                VersionConflict(),

            _ => throw new InvalidOperationException(
                "Unexpected write status."
            )
        };
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(
        StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromQuery] Guid? version,
        CancellationToken ct)
    {
        var userId = CurrentUserId;

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized();
        }

        if (version is null)
        {
            return Problem(
                statusCode: 400,
                title: "Version is required",
                detail:
                    "Provide the item's current version in the query string."
            );
        }

        var result = await service.DeleteAsync(
            userId,
            id,
            version.Value,
            ct
        );

        return result switch
        {
            WorkItemWriteStatus.Success =>
                NoContent(),

            WorkItemWriteStatus.NotFound =>
                NotFound(),

            WorkItemWriteStatus.VersionConflict =>
                VersionConflict(),

            _ => throw new InvalidOperationException(
                "Unexpected write status."
            )
        };
    }

    private ObjectResult VersionConflict()
    {
        return Problem(
            statusCode: 409,
            title: "This item changed",
            detail:
                "Reload the latest item before editing or deleting it."
        );
    }
}