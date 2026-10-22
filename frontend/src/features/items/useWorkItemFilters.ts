import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { statuses, type WorkItemFilters, type WorkStatus } from "./types";

const PAGE_SIZE = 6;
const MAX_PAGE = 1_000_000;

function readFilters(params: URLSearchParams): WorkItemFilters {
  const rawStatus = params.get("status");
  const rawPage = params.get("page") ?? "1";

  const page = /^[1-9]\d{0,6}$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    search: (params.get("search") ?? "").trim().slice(0, 120),

    status: statuses.find((status) => status === rawStatus) ?? "",

    page: page <= MAX_PAGE ? page : 1,
    pageSize: PAGE_SIZE,
  };
}

export function useWorkItemFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  function updateFilters(patch: Partial<WorkItemFilters>) {
    setSearchParams((previous) => {
      // Preserve unrelated parameters and avoid mutating
      // React Router's current URLSearchParams object.
      const next = new URLSearchParams(previous);

      const updated = {
        ...readFilters(previous),
        ...patch,
      };

      if (updated.search) {
        next.set("search", updated.search);
      } else {
        next.delete("search");
      }

      if (updated.status) {
        next.set("status", updated.status);
      } else {
        next.delete("status");
      }

      if (updated.page > 1) {
        next.set("page", String(updated.page));
      } else {
        next.delete("page");
      }

      return next;
    });
  }

  function setSearch(search: string) {
    updateFilters({
      search: search.trim().slice(0, 120),
      page: 1,
    });
  }

  function clearFilters() {
    updateFilters({
      search: "",
      status: "",
      page: 1,
    });
  }

  function changeStatus(status: WorkStatus | "") {
    updateFilters({
      status,
      page: 1,
    });
  }

  function changePage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
      return;
    }

    updateFilters({ page });
  }

  return {
    filters,
    searchKey: searchParams.toString(),
    setSearch,
    clearFilters,
    changeStatus,
    changePage,
  };
}
