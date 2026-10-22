import type { ReactNode } from "react";

type WorkItemCardProps = {
  title: string;
  description: string;
  status: "Backlog" | "InProgress" | "Done";
  priority?: "Low" | "Medium" | "High";
  dueDate?: string | null;
  actions?: ReactNode;
};

export function WorkItemCard({
  title,
  description,
  status,
  priority,
  dueDate,
  actions,
}: WorkItemCardProps) {
  return (
    <article className="work-item-card panel">
      <div className="card-meta">
        <span className={`status-badge status-${status}`}>
          {status === "InProgress" ? "In progress" : status}
        </span>

        {priority && (
          <span className={`priority priority-${priority}`}>
            <span aria-hidden="true">●</span>
            {priority}
          </span>
        )}
      </div>

      <h3>{title}</h3>

      <p className="card-description">
        {description || "No description added."}
      </p>

      <div className="card-footer">
        <span>{dueDate ? `Due ${dueDate}` : "No due date"}</span>

        {actions}
      </div>
    </article>
  );
}
