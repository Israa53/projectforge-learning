import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createWorkItem,
  updateWorkItem,
  deleteWorkItem,
} from './api';

import type {
  NewWorkItemInput,
  WorkItem,
} from './types';

type UpdateVariables = {
  item: Pick<WorkItem, 'id' | 'version'>;
  input: NewWorkItemInput;
};

export function useCreateWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkItem,
    retry: false,

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['work-items', 'list'],
      }),
  });
}

export function useUpdateWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ item, input }: UpdateVariables) =>
      updateWorkItem(item, input),

    retry: false,

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['work-items', 'list'],
      }),
  });
}

export function useDeleteWorkItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkItem,
    retry: false,

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['work-items', 'list'],
      }),
  });
}