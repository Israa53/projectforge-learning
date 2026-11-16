import { Button } from "../../components/ui/Button";
import { useWorkItemStats } from "./useWorkItemStats";

const cards = [
    { key: "total", label: "Total items" },
    { key: "backlog", label: "Backlog" },
    { key: "inProgress", label: "In progress" },
    { key: "done", label: "Done" },
] as const;

export function WorkItemStatsPanel() {
    const {
        data,
        isPending,
        isFetching,
        isError,
        refetch,
    } = useWorkItemStats();

    return (
        <section
            className="stats-summary"
            aria-label="Work item overview"
            aria-busy={isFetching}
        >
            {isPending && (
                <p className="results-update" role="status">
                    Loading your overview…
                </p>
            )}

            {data && (
                <dl className="stats-grid">
                    {cards.map(card => (
                        <div
                            key={card.key}
                            className={`panel stats-card stats-card--${card.key}`}
                        >
                            <dt>{card.label}</dt>
                            <dd>{data[card.key].toLocaleString()}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {isError && (
                <div className="notice notice--error" role="alert">
                    <p>
                        {data
                            ? "Couldn’t refresh your overview. Showing previous counts."
                            : "Couldn’t load your overview."}
                    </p>

                    <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        disabled={isFetching}
                        onClick={() => void refetch()}
                    >
                        Try again
                    </Button>
                </div>
            )}
        </section>
    );
}