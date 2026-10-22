# ProjectForge

## Goal
Track work items through Backlog, InProgress, and Done.

## First vertical slice
Create a work item through React, persist it through ASP.NET Core
in SQLite, and display it after restarting the backend.

## Acceptance criteria
- A valid creation returns HTTP 201 and the saved item.
- A title shorter than 3 characters returns HTTP 400.
- Saved items remain after restarting the backend.

## Later features
- Edit and delete work items.
- Search, status filtering, and pagination.
- Reject stale edits with HTTP 409.