import { useRef, useState } from 'react';

import { useDeleteWorkItem } from './useItemMutations';
import type { WorkItem } from './types';

type DeleteWorkItemProps = {
    item: WorkItem;
    onDeleted: () => void;
};

export function DeleteWorkItem({
    item,
    onDeleted,
}: DeleteWorkItemProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);

    const [isConfirming, setIsConfirming] = useState(false);

    const deletion = useDeleteWorkItem();
    const isDeleting = deletion.isPending;

    function cancelDelete() {
        setIsConfirming(false);
        deletion.reset();
        triggerRef.current?.focus();
    }

    async function handleDelete() {
        if (isDeleting) return;

        try {
            await deletion.mutateAsync(item);
            onDeleted();
        } catch {
            // The mutation exposes the error for rendering below.
        }
    }

    return (
        <div className="item-delete">
            <button
                ref={triggerRef}
                type="button"
                className="item-delete-trigger"
                aria-label={`Delete ${item.title}`}
                title="Delete item"
                aria-expanded={isConfirming}
                disabled={isDeleting}
                onClick={() => {
                    if (isConfirming) {
                        cancelDelete();
                    } else {
                        deletion.reset();
                        setIsConfirming(true);
                    }
                }}
            >
                <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M3 6h18" />
                    <path d="M9 6V4h6v2" />
                    <path d="M5 6l1 14h12l1-14" />
                    <path d="M10 10v6M14 10v6" />
                </svg>
            </button>

            {isConfirming && (
                <div
                    className="item-delete-panel"
                    role="group"
                    aria-label={`Confirm deletion of ${item.title}`}
                    onKeyDown={event => {
                        if (event.key === 'Escape' && !isDeleting) {
                            cancelDelete();
                        }
                    }}
                >
                    <strong>Delete this item?</strong>
                    <p>This action cannot be undone.</p>

                    {deletion.error && (
                        <p className="error" role="alert">
                            {deletion.error.message}
                        </p>
                    )}

                    <div className="item-delete-buttons">
                        <button
                            autoFocus
                            type="button"
                            className="item-delete-cancel"
                            disabled={isDeleting}
                            onClick={cancelDelete}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            className="item-delete-confirm"
                            disabled={isDeleting}
                            onClick={() => void handleDelete()}
                        >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}