using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// "AddControllers" registers services needed by your controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(allowIntegerValues: false)
        );
    });
// "AddOpenApi" registers services needed for OpenAPI (Swagger) documentation.
builder.Services.AddOpenApi();

// "AddDbContext" registers the application's database context with the dependency injection container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(
        builder.Configuration.GetConnectionString("Database")
    )
);

// User accounts and password management.
builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;

        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
    })
    .AddEntityFrameworkStores<AppDbContext>();

// "Build" builds the application.
var app = builder.Build();

// "IsDevelopment" checks if the application is running in the development environment and enables API documentation during local development.
if (app.Environment.IsDevelopment())
{
    // "MapOpenApi" maps the OpenAPI endpoint and enables the Swagger UI.
    app.MapOpenApi();

    // "UseSwaggerUI" configures the Swagger UI for API documentation.
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint(
            "/openapi/v1.json",
            "ProjectForge API v1"
        );
    });
}

// "MapControllers" matches HTTP requests to controller actions.
app.MapControllers();

// "Run" runs the application.
app.Run();