import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { getWorkItems } from "./api";
import { useWorkItems } from "./useWorkItems";
import type { PagedResult, WorkItem, WorkItemFilters } from "./types";

vi.mock("./api", () => ({
    getWorkItems: vi.fn(),
}));

function makePage(page: number, title: string): PagedResult<WorkItem> {
    return {
        items: [
            {
                id: `item-${page}`,
                title,
                description: "",
                status: "Backlog",
                priority: "Medium",
                dueDate: null,
                createdAt: "2026-11-01T10:00:00Z",
                updatedAt: "2026-11-01T10:00:00Z",
                version: `version-${page}`,
            },
        ],
        totalCount: 7,
        page,
        pageSize: 6,
    };
}

it("keeps page one visible while page two is loading", async () => {
    const filters: WorkItemFilters = {
        search: "invoice",
        status: "",
        page: 1,
        pageSize: 6,
    };

    let resolvePageTwo!: (value: PagedResult<WorkItem>) => void;
    const pendingPageTwo = new Promise<PagedResult<WorkItem>>(resolve => {
        resolvePageTwo = resolve;
    });

    const api = vi.mocked(getWorkItems);
    api.mockResolvedValueOnce(makePage(1, "Build invoice editor"));
    api.mockReturnValueOnce(pendingPageTwo);

    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    function Wrapper({ children }: PropsWithChildren) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }

    const { result, rerender, unmount } = renderHook(
        ({ page }: { page: number }) => useWorkItems({ ...filters, page }),
        { initialProps: { page: 1 }, wrapper: Wrapper },
    );

    try {
        await waitFor(() => {
            expect(result.current.data?.items[0]?.title)
                .toBe("Build invoice editor");
        });

        rerender({ page: 2 });

        await waitFor(() => {
            expect(api.mock.calls[1]?.[0]).toEqual({ ...filters, page: 2 });
            expect(result.current.isPlaceholderData).toBe(true);
        });

        expect(result.current.data?.page).toBe(1);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isRefreshing).toBe(true);

        resolvePageTwo(makePage(2, "Validate invoice email"));

        await waitFor(() => {
            expect(result.current.data?.page).toBe(2);
            expect(result.current.data?.items[0]?.title)
                .toBe("Validate invoice email");
            expect(result.current.isPlaceholderData).toBe(false);
        });
    } finally {
        unmount();
        client.clear();
    }
});