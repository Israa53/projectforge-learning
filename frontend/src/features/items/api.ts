import type {
  NewWorkItemInput,
  PagedResult,
  WorkItem,
  WorkItemFilters,
} from "./types";

export async function getWorkItems(
  filters: WorkItemFilters,
  signal?: AbortSignal,
): Promise<PagedResult<WorkItem>> {
  const params = new URLSearchParams({
    Search: filters.search,
    Page: String(filters.page),
    PageSize: String(filters.pageSize),
  });

  if (filters.status !== "") {
    const statusValues = {
      Backlog: 0,
      InProgress: 1,
      Done: 2,
    };

    params.set("Status", String(statusValues[filters.status]));
  }

  const response = await fetch(`/api/work-items?${params}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Could not load work items. HTTP ${response.status}.`);
  }

  return response.json();
}

export async function createWorkItem(
  input: NewWorkItemInput,
): Promise<WorkItem> {
  const response = await fetch("/api/work-items", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));

    throw new Error(
      problem.detail ??
        problem.title ??
        `Could not create work item. HTTP ${response.status}.`,
    );
  }

  return response.json();
}

export async function deleteWorkItem(
  item: Pick<WorkItem, "id" | "version">,
): Promise<void> {
  const params = new URLSearchParams({
    version: item.version,
  });

  const response = await fetch(`/api/work-items/${item.id}?${params}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));

    throw new Error(
      problem.detail ??
        problem.title ??
        `Could not delete work item. HTTP ${response.status}.`,
    );
  }

  // Successful DELETE returns 204 with no JSON body.
}

export async function updateWorkItem(
  item: Pick<WorkItem, "id" | "version">,
  input: NewWorkItemInput,
): Promise<WorkItem> {
  const response = await fetch(`/api/work-items/${item.id}`, {
    method: "PUT",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      ...input,
      version: item.version,
    }),
  });

  if (response.status === 409) {
    throw new Error(
      "This item changed since you opened it. Your draft has not been saved. " +
        "Copy your changes, cancel editing, and reopen the item after the list reloads.",
    );
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));

    throw new Error(
      problem.detail ??
        problem.title ??
        `Could not update work item. HTTP ${response.status}.`,
    );
  }

  return response.json();
}
