import {
    useEffect,
    useId,
    useRef,
} from "react";

import { createPortal } from "react-dom";

import { Button } from "./Button";

type UnsavedChangesDialogProps = {
    onStay: () => void;
    onLeave: () => void;
};

export function UnsavedChangesDialog({
    onStay,
    onLeave,
}: UnsavedChangesDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;

        if (!dialog) {
            return;
        }

        if (!dialog.open) {
            dialog.showModal();
        }

        return () => {
            dialog.close();
        };
    }, []);

    return createPortal(
        <dialog
            ref={dialogRef}
            className="panel confirm-dialog"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={event => {
                // Escape means "stay".
                event.preventDefault();
                onStay();
            }}
        >
            <h2 id={titleId}>
                Leave without saving?
            </h2>

            <p id={descriptionId}>
                You have unsaved changes. Stay to finish
                editing, or leave this page.
            </p>

            <div className="dialog-actions">
                <Button
                    variant="secondary"
                    autoFocus
                    onClick={onStay}
                >
                    Stay here
                </Button>

                <Button
                    variant="danger"
                    onClick={onLeave}
                >
                    Leave page
                </Button>
            </div>
        </dialog>,
        document.body,
    );
}