import "./features/items/WorkItems.css";
import { FormField } from "./components/ui/FormField";
import { Button } from "./components/ui/Button";
import { useState, type FormEvent } from "react";
import { WorkItemCard } from "./components/WorkItemCard";
import { WorkItemForm } from "./features/items/WorkItemForm";
import { DeleteWorkItem } from "./features/items/DeleteWorkItem";
import { useWorkItems } from "./features/items/useWorkItems";
import {
  useWorkItemFilters,
} from "./features/items/useWorkItemFilters";
import {
  useCreateWorkItem,
  useUpdateWorkItem,
} from "./features/items/useItemMutations";

import {
  statuses,
  type NewWorkItemInput,
  type WorkItem,
  type WorkStatus,
} from "./features/items/types";

export default function App() {
  // useState Remembers the selected filter between renders
  const {
    filters,
    searchKey,
    setSearch,
    clearFilters,
    changeStatus,
    changePage,
  } = useWorkItemFilters();

  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const createItem = useCreateWorkItem();
  const updateItem = useUpdateWorkItem();
  const isUpdating = updateItem.isPending;
  const { data, isLoading, error, reloadItems } = useWorkItems(filters);



  async function handleCreate(input: NewWorkItemInput): Promise<void> {
    await createItem.mutateAsync(input);

    clearFilters();
  }

  async function handleSave(input: NewWorkItemInput): Promise<void> {
    if (!editingItem) {
      await handleCreate(input);
      return;
    }

    await updateItem.mutateAsync({
      item: editingItem,
      input,
    });

    setEditingItem(null);
  }

  function cancelEditing() {
    setEditingItem(null);
    reloadItems();
  }

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setSearch(String(formData.get("search") ?? ""));
  }

  function handleDeleted() {
    changePage(1);
  }
  const totalPages = data
    ? Math.max(1, Math.ceil(data.totalCount / data.pageSize))
    : 1;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>ProjectForge</span>
        </div>

        <span className="topbar-caption">Your delivery workspace</span>
      </header>

      <main className="workspace">
        <header className="page-header">
          <span className="eyebrow">WORK MANAGEMENT</span>
          <h1>Make progress visible.</h1>
          <p>Capture your next task and keep delivery moving.</p>
        </header>

        <div className="dashboard">
          <aside className="editor-column">
            <WorkItemForm
              key={
                editingItem
                  ? `${editingItem.id}:${editingItem.version}`
                  : "create"
              }
              item={editingItem ?? undefined}
              onSave={handleSave}
              onCancel={cancelEditing}
            />
          </aside>

          <section
            className="list-panel panel"
            aria-labelledby="work-items-heading"
          >
            <div className="section-heading">
              <div>
                <h2 id="work-items-heading">Work items</h2>
                <p>Find and focus on the work that matters.</p>
              </div>

              {!isLoading && error === null && data !== null && (
                <span className="count-badge">{data.totalCount} matching</span>
              )}
            </div>

            <form className="filter-bar" onSubmit={handleSearch}>
              <div className="search-field">
                <FormField htmlFor="search" label="Search work items">
                  <input
                    key={searchKey}
                    id="search"
                    name="search"
                    type="search"
                    placeholder="Search title or description…"
                    maxLength={120}
                    defaultValue={filters.search}
                  />
                </FormField>
              </div>

              <div className="status-field">
                <FormField htmlFor="status-filter" label="Status">
                  <select
                    id="status-filter"
                    value={filters.status}
                    onChange={(event) =>
                      changeStatus(event.target.value as WorkStatus | "")
                    }
                  >
                    <option value="">All statuses</option>

                    {statuses.map((status) => (
                      // .map() Converts each status into an <option> element
                      <option key={status} value={status}>
                        {status === "InProgress" ? "In progress" : status}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <Button type="submit">Search</Button>

              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            </form>

            <div className="results" aria-busy={isLoading}>
              {isLoading && (
                <div className="feedback-panel" role="status">
                  <span className="loading-dot" aria-hidden="true" />
                  Loading your work items…
                </div>
              )}

              {!isLoading && error !== null && (
                <div className="feedback-panel feedback-error" role="alert">
                  <h3>We couldn’t load your work.</h3>
                  <p>{error}</p>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={reloadItems}
                  >
                    Try again
                  </Button>
                </div>
              )}

              {!isLoading && error === null && data !== null && (
                <>
                  {data.items.length === 0 ? (
                    <div className="feedback-panel">
                      <h3>No work items found.</h3>
                      <p>Create an item or adjust your filters.</p>
                    </div>
                  ) : (
                    <div className="work-item-grid">
                      {data.items.map((item) => (
                        <WorkItemCard
                          key={item.id} // Unique key helps React identify which items have changed
                          title={item.title}
                          description={item.description}
                          status={item.status}
                          priority={item.priority}
                          dueDate={item.dueDate}
                          actions={
                            <div className="card-actions">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="item-edit-trigger"
                                aria-label={`Edit ${item.title}`}
                                title="Edit item"
                                disabled={isUpdating}
                                onClick={() => setEditingItem(item)}
                              >
                                <svg
                                  width="17"
                                  height="17"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" />
                                </svg>
                              </Button>

                              <DeleteWorkItem
                                item={item}
                                onDeleted={handleDeleted}
                              />
                            </div>
                          }
                        />
                      ))}
                    </div>
                  )}

                  <nav className="pagination" aria-label="Pagination">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={data.page <= 1}
                      onClick={() => changePage(data.page - 1)}
                    >
                      Previous
                    </Button>

                    <span>
                      Page {data.page} · {totalPages} total
                    </span>

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={data.page * data.pageSize >= data.totalCount}
                      onClick={() => changePage(data.page + 1)}
                    >
                      Next
                    </Button>
                  </nav>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
