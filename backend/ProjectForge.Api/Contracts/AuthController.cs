using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Controllers;

[ApiController]
[Route("api/auth")]
[RequireHttps]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;

    public AuthController(UserManager<ApplicationUser> users)
    {
        _users = users;
    }

    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(
        typeof(ValidationProblemDetails),
        StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterInput input)
    {
        var email = input.Email.Trim();

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email
        };

        var result = await _users.CreateAsync(
            user,
            input.Password
        );

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(
                    "registration",
                    error.Description
                );
            }

            return ValidationProblem(ModelState);
        }

        return StatusCode(
            StatusCodes.Status201Created,
            new
            {
                message = "Account created successfully."
            }
        );
    }
}