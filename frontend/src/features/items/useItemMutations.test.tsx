import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { getWorkItem, getWorkItems, updateWorkItem } from "./api";
import { useUpdateWorkItem } from "./useItemMutations";
import type { NewWorkItemInput, WorkItem, WorkItemFilters } from "./types";
import { useWorkItem } from "./useWorkItem";
import { useWorkItems } from "./useWorkItems";

vi.mock("./api", () => ({
    getWorkItem: vi.fn(),
    getWorkItems: vi.fn(),
    updateWorkItem: vi.fn(),
}));

it("refreshes the list and detail after saving an edit", async () => {
    const filters: WorkItemFilters = {
        search: "",
        status: "",
        page: 1,
        pageSize: 6,
    };

    const original: WorkItem = {
        id: "item-1",
        title: "Build invoice editor",
        description: "",
        status: "Backlog",
        priority: "Medium",
        dueDate: null,
        createdAt: "2026-11-01T10:00:00Z",
        updatedAt: "2026-11-01T10:00:00Z",
        version: "version-1",
    };

    const input: NewWorkItemInput = {
        title: "Build and validate invoice editor",
        description: "",
        status: "InProgress",
        priority: "Medium",
        dueDate: null,
    };

    // The fake server returns the old record until the update succeeds.
    let storedItem = original;

    vi.mocked(getWorkItems).mockImplementation(async () => ({
        items: [storedItem],
        totalCount: 1,
        page: 1,
        pageSize: 6,
    }));

    vi.mocked(getWorkItem).mockImplementation(async () => storedItem);

    vi.mocked(updateWorkItem).mockImplementation(async (_item, changes) => {
        storedItem = { ...storedItem, ...changes, version: "version-2" };
        return storedItem;
    });

    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    function Wrapper({ children }: PropsWithChildren) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }

    const { result, unmount } = renderHook(
        () => ({
            list: useWorkItems(filters),
            detail: useWorkItem(original.id),
            update: useUpdateWorkItem(),
        }),
        { wrapper: Wrapper },
    );

    try {
        await waitFor(() => {
            expect(result.current.list.data?.items[0]?.title).toBe(original.title);
            expect(result.current.detail.data?.title).toBe(original.title);
        });

        const item = { id: original.id, version: original.version };

        await act(async () => {
            await result.current.update.mutateAsync({ item, input });
        });

        expect(updateWorkItem).toHaveBeenCalledWith(item, input);

        await waitFor(() => {
            expect(result.current.list.data?.items[0]?.title).toBe(input.title);
            expect(result.current.detail.data?.title).toBe(input.title);
            expect(result.current.detail.data?.version).toBe("version-2");
        });
    } finally {
        unmount();
        client.clear();
    }
});