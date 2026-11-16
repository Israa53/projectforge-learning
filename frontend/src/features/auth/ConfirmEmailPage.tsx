import { useState } from "react";
import { Link, useLocation } from "react-router";

import { Button } from "../../components/ui/Button";
import { confirmEmail } from "./confirmEmail";

export function ConfirmEmailPage() {
    const location = useLocation();

    return (
        <ConfirmationForm
            key={location.hash}
            fragment={location.hash}
        />
    );
}

function ConfirmationForm({ fragment }: { fragment: string }) {
    const parameters = new URLSearchParams(fragment.slice(1));
    const userId = parameters.get("userId");
    const code = parameters.get("code");

    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConfirm() {
        if (!userId || !code || isSaving) return;

        setIsSaving(true);
        setError(null);

        try {
            await confirmEmail(userId, code);
            setIsConfirmed(true);
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Could not confirm your email.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    const hasLink = Boolean(userId && code);

    return (
        <main className="auth-page auth-screen">
            <section
                className="auth-card panel confirmation-card"
                aria-labelledby="confirmation-heading"
            >
                <div className="confirmation-icon" aria-hidden="true">
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {isConfirmed ? (
                            <path d="m5 12 4 4L19 6" />
                        ) : (
                            <>
                                <rect x="3" y="5" width="18" height="14" rx="3" />
                                <path d="m3 7 9 6 9-6" />
                            </>
                        )}
                    </svg>
                </div>

                <span className="eyebrow">ACCOUNT VERIFICATION</span>

                <h1 id="confirmation-heading">
                    {isConfirmed ? "You’re all verified." : "One last step."}
                </h1>

                <p className="auth-description">
                    {isConfirmed
                        ? "Your email is confirmed. Your ProjectForge workspace is ready."
                        : hasLink
                            ? "Confirm your email address to finish setting up your ProjectForge account."
                            : "This link is incomplete. Open the full confirmation link from your email."}
                </p>

                {isConfirmed && (
                    <p className="notice notice--success" role="status">
                        Email confirmed successfully.
                    </p>
                )}

                {!isConfirmed && hasLink && (
                    <Button
                        type="button"
                        className="confirmation-submit"
                        isLoading={isSaving}
                        loadingText="Confirming…"
                        onClick={() => void handleConfirm()}
                    >
                        Confirm email address
                    </Button>
                )}

                {error && (
                    <p className="notice notice--error" role="alert">
                        {error}
                    </p>
                )}

                <div className="auth-switch">
                    <Link className="text-link" to="/login">
                        {isConfirmed ? "Continue to sign in →" : "← Back to sign in"}
                    </Link>
                </div>
            </section>
        </main>
    );
}