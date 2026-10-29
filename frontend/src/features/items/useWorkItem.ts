import { queryOptions, useQuery } from "@tanstack/react-query";

import { getWorkItem } from "./api";

export function workItemQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["work-items", "detail", id],

    queryFn: ({ signal }) => getWorkItem(id, signal),

    staleTime: 30_000,
  });
}

export function useWorkItem(id: string) {
  return useQuery({
    ...workItemQueryOptions(id),
    enabled: id.length > 0,
  });
}
