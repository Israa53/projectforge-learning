import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkItemForm } from "./WorkItemForm";
describe("WorkItemForm", () => {
    it("starts with an empty title when creating an item", () => {
        const onSave = vi.fn().mockResolvedValue(undefined);

        render(<WorkItemForm onSave={onSave} />);

        expect(
            screen.getByRole("textbox", { name: /^title/i }),
        ).toHaveValue("");
    });

    it("shows a validation error instead of saving a short title", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);

        render(<WorkItemForm onSave={onSave} />);

        await user.type(
            screen.getByRole("textbox", { name: /^title/i }),
            "ab",
        );

        await user.click(
            screen.getByRole("button", { name: /create/i }),
        );

        expect(
            await screen.findByText(
                "Enter a title between 3 and 120 characters.",
            ),
        ).toBeInTheDocument();

        expect(onSave).not.toHaveBeenCalled();

        expect(
            screen.getByRole("textbox", { name: /^title/i }),
        ).toHaveValue("ab");
    });
    it("sends a trimmed title and clears the form after saving", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockResolvedValue(undefined);

        render(<WorkItemForm onSave={onSave} />);

        const title = screen.getByRole("textbox", { name: /^title/i });
        await user.type(title, "  Build invoice editor  ");
        await user.click(screen.getByRole("button", { name: /create/i }));

        expect(onSave).toHaveBeenCalledExactlyOnceWith({
            title: "Build invoice editor",
            description: "",
            status: "Backlog",
            priority: "Medium",
            dueDate: null,
        });

        await waitFor(() => {
            expect(title).toHaveValue("");
        });
    });

    it("prevents a second submission while saving", async () => {
        const user = userEvent.setup();

        let finishSave!: () => void;
        const pendingSave = new Promise<void>(resolve => {
            finishSave = resolve;
        });
        const onSave = vi.fn().mockReturnValue(pendingSave);

        render(<WorkItemForm onSave={onSave} />);

        await user.type(
            screen.getByRole("textbox", { name: /^title/i }),
            "Build invoice editor",
        );

        const createButton = screen.getByRole("button", { name: /create/i });

        await user.click(createButton);
        expect(createButton).toBeDisabled();

        await user.click(createButton);
        expect(onSave).toHaveBeenCalledTimes(1);

        finishSave();

        await waitFor(() => {
            expect(createButton).toBeEnabled();
        });
    });

    it("shows a save error and keeps the draft available for retry", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockRejectedValue(
            new Error("The server could not save this item."),
        );

        render(<WorkItemForm onSave={onSave} />);

        const title = screen.getByRole("textbox", { name: /^title/i });
        await user.type(title, "Build invoice editor");
        await user.click(screen.getByRole("button", { name: /create/i }));

        expect(
            await screen.findByText("The server could not save this item."),
        ).toBeInTheDocument();

        expect(title).toHaveValue("Build invoice editor");
        expect(screen.getByRole("button", { name: /create/i })).toBeEnabled();
    });
});