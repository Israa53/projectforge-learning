import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getWorkItems } from "./api";
import type { WorkItemFilters } from "./types";

export function useWorkItems(filters: WorkItemFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["work-items", "list", filters],

    queryFn: ({ signal }) => getWorkItems(filters, signal),
  });

  function reloadItems() {
    void queryClient.invalidateQueries({
      queryKey: ["work-items", "list"],
    });
  }

  return {
    data: query.data ?? null,
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    reloadItems,
    isRefreshing: query.isFetching && !query.isPending,
  };
}
