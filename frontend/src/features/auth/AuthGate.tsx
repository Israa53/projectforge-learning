import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { LoginPage } from "./LoginPage";

export function AuthGate({
    children,
}: {
    children: ReactNode;
}) {
    const { state, logout, retrySession } = useAuth();
    const [logoutError, setLogoutError] = useState<string | null>(
        null,
    );

    async function handleLogout() {
        setLogoutError(null);

        try {
            await logout();
        } catch (cause) {
            setLogoutError(
                cause instanceof Error
                    ? cause.message
                    : "Could not sign out. Please try again.",
            );
        }
    }

    if (state.status === "loading") {
        return (
            <main className="auth-page">
                <p role="status">Checking your session…</p>
            </main>
        );
    }

    if (state.status === "error") {
        return (
            <main className="auth-page">
                <section className="auth-card">
                    <h1>Couldn’t connect.</h1>
                    <p role="alert">{state.message}</p>

                    <button type="button" onClick={retrySession}>
                        Try again
                    </button>
                </section>
            </main>
        );
    }

    if (state.status === "anonymous") {
        return <LoginPage />;
    }

    return (
        <>
            <div className="session-bar">
                <span>{state.user.email}</span>

                <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void handleLogout()}
                >
                    Sign out
                </button>

                {logoutError !== null && (
                    <p className="auth-error" role="alert">
                        {logoutError}
                    </p>
                )}
            </div>

            {children}
        </>
    );
}