using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectForge.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkItemOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkItems_Status_CreatedAt",
                table: "WorkItems");

            migrationBuilder.AddColumn<string>(
                name: "OwnerId",
                table: "WorkItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_OwnerId_Status_CreatedAt",
                table: "WorkItems",
                columns: new[] { "OwnerId", "Status", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_WorkItems_AspNetUsers_OwnerId",
                table: "WorkItems",
                column: "OwnerId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WorkItems_AspNetUsers_OwnerId",
                table: "WorkItems");

            migrationBuilder.DropIndex(
                name: "IX_WorkItems_OwnerId_Status_CreatedAt",
                table: "WorkItems");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "WorkItems");

            migrationBuilder.CreateIndex(
                name: "IX_WorkItems_Status_CreatedAt",
                table: "WorkItems",
                columns: new[] { "Status", "CreatedAt" });
        }
    }
}
