import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/http";
import { WorkItemForm } from "./WorkItemForm";
import type { WorkItem } from "./types";

const existingItem: WorkItem = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Build invoice editor",
    description: "Add invoice line items",
    status: "InProgress",
    priority: "High",
    dueDate: "2026-11-30",
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-02T10:00:00Z",
    version: "22222222-2222-4222-8222-222222222222",
};

describe("WorkItemForm in edit mode", () => {
    it("loads the existing values and lets the user cancel without saving", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);
        const onCancel = vi.fn();

        render(
            <WorkItemForm
                item={existingItem}
                onSave={onSave}
                onCancel={onCancel}
            />,
        );

        expect(screen.getByRole("textbox", { name: "Title" }))
            .toHaveValue(existingItem.title);
        expect(screen.getByRole("combobox", { name: "Status" }))
            .toHaveValue("InProgress");
        expect(screen.getByLabelText(/due date/i))
            .toHaveValue(existingItem.dueDate);

        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onSave).not.toHaveBeenCalled();
    });

    it("focuses the field rejected by the server and clears its error after editing", async () => {
        const user = userEvent.setup();
        const message = "Add more detail to the description.";
        const onSave = vi.fn().mockRejectedValue(
            new ApiError("Validation failed.", 400, {
                "input.Description": [message],
            }),
        );

        render(<WorkItemForm item={existingItem} onSave={onSave} />);

        const description = screen.getByRole("textbox", { name: "Description" });
        await user.clear(description);
        await user.type(description, "Add invoice fields");
        await user.click(screen.getByRole("button", { name: "Save" }));

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(description).toHaveAccessibleDescription(message);
        expect(description).toHaveFocus();
        expect(description).toHaveValue("Add invoice fields");

        await user.type(description, " and totals");

        expect(screen.queryByText(message)).not.toBeInTheDocument();
        expect(description).toHaveValue("Add invoice fields and totals");
    });
});