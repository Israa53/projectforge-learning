import {
    Link,
    useLocation,
    useParams,
} from "react-router";

import { Button } from "../../components/ui/Button";
import { ApiError } from "../../lib/http";

import { useWorkItem } from "./useWorkItem";

import "./WorkItems.css";

export function WorkItemDetails() {
    const { id = "" } = useParams<{ id: string }>();

    const location = useLocation();

    const {
        data: item,
        isPending,
        isError,
        error,
        refetch,
        isFetching,
    } = useWorkItem(id);

    // The details link carries the list's query string.
    const listUrl = `/work-items${location.search}`;

    let content;

    if (!id) {
        content = (
            <div className="feedback-panel">
                <h3>Work item not found.</h3>
            </div>
        );
    } else if (isPending) {
        content = (
            <div className="feedback-panel" role="status">
                Loading work item…
            </div>
        );
    } else if (isError) {
        const notFound =
            error instanceof ApiError &&
            error.status === 404;

        content = (
            <div
                className="feedback-panel"
                role={notFound ? undefined : "alert"}
            >
                <h3>
                    {notFound
                        ? "Work item not found."
                        : "Couldn’t load this item."}
                </h3>

                <p>
                    {notFound
                        ? "This item may have been removed or is unavailable to your account."
                        : error.message}
                </p>

                {!notFound && (
                    <Button
                        variant="secondary"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        Try again
                    </Button>
                )}
            </div>
        );
    } else if (item) {
        content = (
            <article className="panel detail-card">
                <div className="detail-meta">
                    <span
                        className={`status-badge status-${item.status}`}
                    >
                        {item.status === "InProgress"
                            ? "In progress"
                            : item.status}
                    </span>

                    <span
                        className={`priority priority-${item.priority}`}
                    >
                        <span aria-hidden="true">●</span>
                        {" "}
                        {item.priority} priority
                    </span>
                </div>

                <h1>{item.title}</h1>

                <h2>Description</h2>

                <p className="detail-description">
                    {item.description || "No description added."}
                </p>

                <dl className="detail-facts">
                    <div>
                        <dt>Due date</dt>
                        <dd>{item.dueDate || "No due date"}</dd>
                    </div>

                    <div>
                        <dt>Created</dt>
                        <dd>
                            {new Date(item.createdAt).toLocaleString()}
                        </dd>
                    </div>

                    <div>
                        <dt>Last updated</dt>
                        <dd>
                            {new Date(item.updatedAt).toLocaleString()}
                        </dd>
                    </div>
                </dl>
            </article>
        );
    }

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand">
                    <span className="brand-mark">P</span>
                    <span>ProjectForge</span>
                </div>

                <span className="topbar-caption">
                    Your delivery workspace
                </span>
            </header>

            <main className="workspace detail-workspace">
                <Link
                    className="text-link detail-back"
                    to={listUrl}
                >
                    ← Back to work items
                </Link>

                {content}
            </main>
        </div>
    );
}