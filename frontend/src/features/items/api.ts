import { ApiError, apiFetch, ensureSuccess } from "../../lib/http";

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
    params.set("Status", filters.status);
  }

  const response = await apiFetch(`/api/work-items?${params}`, { signal });

  await ensureSuccess(response);

  return response.json();
}

export async function createWorkItem(
  input: NewWorkItemInput,
): Promise<WorkItem> {
  const response = await apiFetch("/api/work-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  await ensureSuccess(response);

  return response.json();
}

export async function deleteWorkItem(
  item: Pick<WorkItem, "id" | "version">,
): Promise<void> {
  const params = new URLSearchParams({
    version: item.version,
  });

  const response = await apiFetch(`/api/work-items/${item.id}?${params}`, {
    method: "DELETE",
  });

  await ensureSuccess(response);

  // DELETE succeeds with 204: there is no JSON body to parse.
}

export async function updateWorkItem(
  item: Pick<WorkItem, "id" | "version">,
  input: NewWorkItemInput,
): Promise<WorkItem> {
  const response = await apiFetch(`/api/work-items/${item.id}`, {
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
    throw new ApiError(
      "This item changed since you opened it. " +
        "Your draft has not been saved. " +
        "Copy your changes, cancel editing, and reopen " +
        "the item after the list reloads.",
      409,
    );
  }

  await ensureSuccess(response);

  return response.json();
}

export async function getWorkItem(
  id: string,
  signal?: AbortSignal,
): Promise<WorkItem> {
  const response = await apiFetch(`/api/work-items/${encodeURIComponent(id)}`, {
    signal,
  });

  await ensureSuccess(response);

  return response.json();
}
