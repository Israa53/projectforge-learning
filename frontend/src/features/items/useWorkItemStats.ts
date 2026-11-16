import { useQuery } from "@tanstack/react-query";
import { getWorkItemStats } from "./api";

export function useWorkItemStats() {
  return useQuery({
    queryKey: ["work-items", "stats"],
    queryFn: ({ signal }) => getWorkItemStats(signal),
    staleTime: 30_000,
  });
}
