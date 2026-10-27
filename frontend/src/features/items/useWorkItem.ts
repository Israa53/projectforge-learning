import { useQuery } from "@tanstack/react-query";

import { getWorkItem } from "./api";

export function useWorkItem(id: string) {
  return useQuery({
    queryKey: ["work-items", "detail", id],

    queryFn: ({ signal }) => getWorkItem(id, signal),

    enabled: id.length > 0,
  });
}
