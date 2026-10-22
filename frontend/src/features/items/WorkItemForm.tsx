import { useState, type FormEvent } from 'react';

import {
    statuses,
    type NewWorkItemInput,
    type Priority,
    type WorkItem,
    type WorkStatus,
} from './types';

type WorkItemFormProps = {
    item?: WorkItem;
    onSave: (input: NewWorkItemInput) => Promise<void>;
    onCancel?: () => void;
};

const emptyDraft: NewWorkItemInput = {
    title: '',
    description: '',
    status: 'Backlog',
    priority: 'Medium',
    dueDate: null,
};

export function WorkItemForm({
    item,
    onSave,
    onCancel,
}: WorkItemFormProps) {
    const [draft, setDraft] = useState<NewWorkItemInput>(() =>
        item
            ? {
                title: item.title,
                description: item.description,
                status: item.status,
                priority: item.priority,
                dueDate: item.dueDate,
            }
            : { ...emptyDraft }
    );

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function change<K extends keyof NewWorkItemInput>(
        field: K,
        value: NewWorkItemInput[K]
    ) {
        setDraft(previous => ({
            ...previous,
            [field]: value,
        }));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isSaving) return;

        const title = draft.title.trim();

        if (title.length < 3 || title.length > 120) {
            setError('Enter a title between 3 and 120 characters.');
            return;
        }

        if (draft.description.length > 4000) {
            setError('Description must not exceed 4000 characters.');
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            await onSave({
                ...draft,
                title,
                description: draft.description.trim(),
            });

            if (!item) {
                setDraft({ ...emptyDraft });
            }
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Could not save the work item.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <form
            className="work-item-form"
            onSubmit={handleSubmit}
            aria-labelledby="work-item-form-heading"
            noValidate
        >
            <h2 id="work-item-form-heading">
                {item ? 'Edit work item' : 'Create a work item'}
            </h2>

            <fieldset disabled={isSaving}>
                <label htmlFor="title">Title</label>

                <input
                    id="title"
                    autoFocus={Boolean(item)}
                    placeholder="What needs to be done?"
                    value={draft.title}
                    maxLength={120}
                    required
                    onChange={event => change('title', event.target.value)}
                />

                <label htmlFor="description">Description</label>

                <textarea
                    id="description"
                    placeholder="Add details or acceptance criteria…"
                    rows={4}
                    value={draft.description}
                    maxLength={4000}
                    onChange={event =>
                        change('description', event.target.value)
                    }
                />

                <label htmlFor="new-status">Status</label>

                <select
                    id="new-status"
                    value={draft.status}
                    onChange={event =>
                        change('status', event.target.value as WorkStatus)
                    }
                >
                    {statuses.map(status => (
                        <option key={status} value={status}>
                            {status === 'InProgress' ? 'In progress' : status}
                        </option>
                    ))}
                </select>

                <label htmlFor="priority">Priority</label>

                <select
                    id="priority"
                    value={draft.priority}
                    onChange={event =>
                        change('priority', event.target.value as Priority)
                    }
                >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select>

                <label htmlFor="due-date">Due date (optional)</label>

                <input
                    id="due-date"
                    type="date"
                    value={draft.dueDate ?? ''}
                    onChange={event =>
                        change('dueDate', event.target.value || null)
                    }
                />

                <div className="form-actions">
                    <button type="submit">
                        {isSaving
                            ? 'Saving…'
                            : item
                                ? 'Save'
                                : 'Create'}
                    </button>

                    {item && onCancel && (
                        <button
                            type="button"
                            className="button-secondary"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </fieldset>

            {error && (
                <p className="error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}