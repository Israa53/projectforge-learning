import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { ApiError } from "../../lib/http";
import { useWarnBeforeUnload } from "../../hooks/useWarnBeforeUnload";

import {
  statuses,
  type NewWorkItemInput,
  type Priority,
  type WorkItem,
  type WorkStatus,
} from "./types";

type WorkItemFormProps = {
  item?: WorkItem;
  onSave: (input: NewWorkItemInput) => Promise<void>;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

type FieldName =
  | "title"
  | "description"
  | "status"
  | "priority"
  | "dueDate";

type FieldErrors = Partial<
  Record<FieldName, string>
>;

const fieldNames: FieldName[] = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
];

function mapServerErrors(
  errors: Record<string, string[]>,
) {
  const fields: FieldErrors = {};
  const formErrors: string[] = [];

  for (const [key, messages] of Object.entries(errors)) {
    // Handles names such as:
    // "Title", "title", and "$.title".
    const lastPart = key
      .split(".")
      .pop()
      ?.toLowerCase();

    const field = fieldNames.find(
      name => name.toLowerCase() === lastPart,
    );

    const message = messages.filter(Boolean).join(" ");

    if (!message) {
      continue;
    }

    if (field) {
      fields[field] = fields[field]
        ? `${fields[field]} ${message}`
        : message;
    } else {
      // Model-level or unknown errors remain visible.
      formErrors.push(message);
    }
  }

  return {
    fields,
    formErrors,
  };
}

const emptyDraft: NewWorkItemInput = {
  title: "",
  description: "",
  status: "Backlog",
  priority: "Medium",
  dueDate: null,
};

export function WorkItemForm({
  item,
  onSave,
  onCancel,
  onDirtyChange,
}: WorkItemFormProps) {
  const [initialDraft] =
    useState<NewWorkItemInput>(() =>
      item
        ? {
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          dueDate: item.dueDate,
        }
        : { ...emptyDraft },
    );

  const [draft, setDraft] =
    useState<NewWorkItemInput>(() => ({
      ...initialDraft,
    }));

  const isDirty =
    draft.title !== initialDraft.title ||
    draft.description !== initialDraft.description ||
    draft.status !== initialDraft.status ||
    draft.priority !== initialDraft.priority ||
    draft.dueDate !== initialDraft.dueDate;

  useWarnBeforeUnload(isDirty);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      onDirtyChange?.(false);
    };
  }, [onDirtyChange]);

  const [isSaving, setIsSaving] = useState(false);

  // General errors, such as network or version errors.
  const [error, setError] = useState<string | null>(null);

  // Used for client-side validation.
  const [submitted, setSubmitted] = useState(false);

  // Used for validation errors returned by ASP.NET.
  const [serverErrors, setServerErrors] =
    useState<FieldErrors>({});

  const focusAfterSave = useRef<FieldName | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);
  const priorityRef = useRef<HTMLSelectElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSaving || !focusAfterSave.current) {
      return;
    }

    const refs = {
      title: titleRef,
      description: descriptionRef,
      status: statusRef,
      priority: priorityRef,
      dueDate: dueDateRef,
    };

    refs[focusAfterSave.current].current?.focus();
    focusAfterSave.current = null;
  }, [isSaving, serverErrors]);

  const trimmedTitle = draft.title.trim();

  const titleError =
    submitted &&
      (trimmedTitle.length < 3 ||
        trimmedTitle.length > 120)
      ? "Enter a title between 3 and 120 characters."
      : serverErrors.title;

  const descriptionError =
    submitted && draft.description.length > 4000
      ? "Description must not exceed 4000 characters."
      : serverErrors.description;

  function change<K extends keyof NewWorkItemInput>(
    field: K,
    value: NewWorkItemInput[K],
  ) {
    // Remove only the server error for the edited field.
    setServerErrors(previous => {
      if (!previous[field]) {
        return previous;
      }

      const next = { ...previous };

      delete next[field];

      return next;
    });

    setDraft(previous => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setSubmitted(true);
    setError(null);
    setServerErrors({});

    const title = draft.title.trim();

    if (title.length < 3 || title.length > 120) {
      titleRef.current?.focus();
      return;
    }

    if (draft.description.length > 4000) {
      descriptionRef.current?.focus();
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        ...draft,
        title,
        description: draft.description.trim(),
      });

      if (!item) {
        setDraft({ ...emptyDraft });
        setSubmitted(false);
      }
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.status === 400 &&
        Object.keys(cause.fieldErrors).length > 0
      ) {
        const mapped = mapServerErrors(
          cause.fieldErrors,
        );

        setServerErrors(mapped.fields);

        focusAfterSave.current =
          fieldNames.find(name => mapped.fields[name]) ??
          null;

        if (mapped.formErrors.length > 0) {
          setError(mapped.formErrors.join(" "));
        } else if (!focusAfterSave.current) {
          setError(cause.message);
        }
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save the work item.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="work-item-form panel"
      onSubmit={handleSubmit}
      aria-labelledby="work-item-form-heading"
      noValidate
    >
      <h2 id="work-item-form-heading">
        {item ? "Edit work item" : "Create a work item"}
      </h2>

      <fieldset
        className="form-stack"
        disabled={isSaving}
      >
        <FormField
          htmlFor="title"
          label="Title"
          error={titleError}
        >
          <input
            id="title"
            ref={titleRef}
            autoFocus={Boolean(item)}
            placeholder="What needs to be done?"
            value={draft.title}
            maxLength={120}
            required
            aria-invalid={titleError ? true : undefined}
            aria-describedby={
              titleError ? "title-error" : undefined
            }
            onChange={event =>
              change("title", event.target.value)
            }
          />
        </FormField>

        <FormField
          htmlFor="description"
          label="Description"
          error={descriptionError}
        >
          <textarea
            id="description"
            ref={descriptionRef}
            placeholder="Add details or acceptance criteria…"
            rows={4}
            value={draft.description}
            maxLength={4000}
            aria-invalid={
              descriptionError ? true : undefined
            }
            aria-describedby={
              descriptionError
                ? "description-error"
                : undefined
            }
            onChange={event =>
              change("description", event.target.value)
            }
          />
        </FormField>

        <FormField
          htmlFor="new-status"
          label="Status"
          error={serverErrors.status}
        >
          <select
            id="new-status"
            ref={statusRef}
            value={draft.status}
            aria-invalid={
              serverErrors.status ? true : undefined
            }
            aria-describedby={
              serverErrors.status
                ? "new-status-error"
                : undefined
            }
            onChange={event =>
              change(
                "status",
                event.target.value as WorkStatus,
              )
            }
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === "InProgress"
                  ? "In progress"
                  : status}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          htmlFor="priority"
          label="Priority"
          error={serverErrors.priority}
        >
          <select
            id="priority"
            ref={priorityRef}
            value={draft.priority}
            aria-invalid={
              serverErrors.priority ? true : undefined
            }
            aria-describedby={
              serverErrors.priority
                ? "priority-error"
                : undefined
            }
            onChange={event =>
              change(
                "priority",
                event.target.value as Priority,
              )
            }
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </FormField>

        <FormField
          htmlFor="due-date"
          label="Due date (optional)"
          error={serverErrors.dueDate}
        >
          <input
            id="due-date"
            ref={dueDateRef}
            type="date"
            value={draft.dueDate ?? ""}
            aria-invalid={
              serverErrors.dueDate ? true : undefined
            }
            aria-describedby={
              serverErrors.dueDate
                ? "due-date-error"
                : undefined
            }
            onChange={event =>
              change(
                "dueDate",
                event.target.value || null,
              )
            }
          />
        </FormField>

        <div className="form-actions">
          <Button
            type="submit"
            isLoading={isSaving}
            loadingText="Saving…"
          >
            {item ? "Save" : "Create"}
          </Button>

          {item && onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </fieldset>

      {error && (
        <p
          className="notice notice--error"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}