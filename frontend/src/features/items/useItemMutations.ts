import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assertCurrentSession, getSessionRevision } from "../../lib/http";

import { createWorkItem, updateWorkItem, deleteWorkItem } from "./api";

import type { NewWorkItemInput, WorkItem } from "./types";

type UpdateVariables = {
  item: Pick<WorkItem, "id" | "version">;
  input: NewWorkItemInput;
};

type MutationSession = {
  revision: number;
};

async function withinCurrentSession<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const revision = getSessionRevision();

  try {
    const result = await operation();

    // Includes the time spent parsing the response body.
    assertCurrentSession(revision);

    return result;
  } catch (cause) {
    // An old session's response must not be treated as current.
    assertCurrentSession(revision);

    throw cause;
  }
}

function useWorkItemInvalidation() {
  const queryClient = useQueryClient();

  function onMutate(): MutationSession {
    return {
      revision: getSessionRevision(),
    };
  }

  function onSuccess(
    _data: unknown,
    _variables: unknown,
    session: MutationSession | undefined,
  ) {
    if (session === undefined || session.revision !== getSessionRevision()) {
      return;
    }

    return queryClient.invalidateQueries({
      queryKey: ["work-items"],
    });
  }

  return {
    onMutate,
    onSuccess,
  };
}

export function useCreateWorkItem() {
  const invalidation = useWorkItemInvalidation();

  return useMutation({
    mutationKey: ["work-items", "create"],

    mutationFn: (input: NewWorkItemInput) =>
      withinCurrentSession(() => createWorkItem(input)),

    retry: false,

    ...invalidation,
  });
}

export function useUpdateWorkItem() {
  const invalidation = useWorkItemInvalidation();

  return useMutation({
    mutationKey: ["work-items", "update"],

    mutationFn: ({ item, input }: UpdateVariables) =>
      withinCurrentSession(() => updateWorkItem(item, input)),

    retry: false,

    ...invalidation,
  });
}

export function useDeleteWorkItem() {
  const invalidation = useWorkItemInvalidation();

  return useMutation({
    mutationKey: ["work-items", "delete"],

    mutationFn: (item: Pick<WorkItem, "id" | "version">) =>
      withinCurrentSession(() => deleteWorkItem(item)),

    retry: false,

    ...invalidation,
  });
}
