export const statuses = ["Backlog", "InProgress", "Done"] as const;
export type WorkStatus = (typeof statuses)[number];
export type NewWorkItemInput = Pick<
  WorkItem,
  "title" | "description" | "status" | "priority" | "dueDate"
>;
export type Priority = "Low" | "Medium" | "High";

export interface WorkItemSummary {
  id: string;
  title: string;
  description: string;
  status: WorkStatus;
}

export interface WorkItem extends WorkItemSummary {
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface WorkItemFilters {
  search: string;
  status: WorkStatus | '';
  page: number;
  pageSize: number;
}