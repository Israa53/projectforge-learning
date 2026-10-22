import { Button } from "../../components/ui/Button";
import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { useIsMutating } from "@tanstack/react-query";
import { Navigate } from "react-router";

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, logout, retrySession } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const pendingWrites = useIsMutating({
    mutationKey: ["work-items"],
  });

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
        <section className="auth-card panel">
          <h1>Couldn’t connect.</h1>
          <p role="alert">{state.message}</p>

          <Button type="button" onClick={retrySession}>
            Try again
          </Button>
        </section>
      </main>
    );
  }

  if (state.status === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="workspace-layout">
      <div className="session-bar">
        <span>{state.user.email}</span>

        <Button
          type="button"
          variant="secondary"
          disabled={pendingWrites > 0}
          onClick={() => void handleLogout()}
        >
          {pendingWrites > 0 ? "Finishing changes…" : "Sign out"}
        </Button>

        {logoutError !== null && (
          <p className="notice notice--error" role="alert">
            {logoutError}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}
