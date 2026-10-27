import { Button } from "./components/ui/Button";
import type { ReactNode } from "react";

import { Link, Navigate, Route, Routes, useLocation } from "react-router";

import App from "./App";

import { AuthGate } from "./features/auth/AuthGate";
import { useAuth } from "./features/auth/AuthProvider";
import { LoginPage } from "./features/auth/LoginPage";
import { WorkItemDetails } from "./features/items/WorkItemDetails";

function getReturnPath(state: unknown): string {
  if (
    typeof state !== "object" ||
    state === null ||
    !("from" in state) ||
    typeof state.from !== "string"
  ) {
    return "/work-items";
  }

  // Only allow a destination belonging to our dashboard.
  // Preserve its query string and fragment.
  const from = state.from;

  if (
    from === "/work-items" ||
    from.startsWith("/work-items?") ||
    from.startsWith("/work-items#") ||
    /^\/work-items\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:[?#].*)?$/i.test(
      from,
    )
  ) {
    return from;
  }

  return "/work-items";
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search + location.hash,
        }}
      />
    );
  }

  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "authenticated") {
    return <Navigate to={getReturnPath(location.state)} replace />;
  }

  return children;
}

function NotFoundPage() {
  const { state } = useAuth();

  const destination =
    state.status === "authenticated" ? "/work-items" : "/login";

  return (
    <main className="auth-page auth-screen">
      <section className="auth-card panel">
        <span className="eyebrow">PAGE NOT FOUND</span>

        <h1>A little off track.</h1>

        <p className="auth-description">
          This page doesn’t exist. Let’s get you back to your workspace.
        </p>

        <div className="auth-switch">
          <Link className="text-link" to={destination}>
            Back to ProjectForge →
          </Link>
        </div>
      </section>
    </main>
  );
}

export function AppRoutes() {
  const { state, retrySession } = useAuth();

  // Finish session restoration before deciding where to redirect.
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

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={state.status === "authenticated" ? "/work-items" : "/login"}
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage key="login" mode="login" />
          </GuestOnly>
        }
      />

      <Route
        path="/register"
        element={
          <GuestOnly>
            <LoginPage key="register" mode="register" />
          </GuestOnly>
        }
      />

      <Route
        path="/work-items"
        element={
          <RequireAuth>
            <AuthGate>
              <App />
            </AuthGate>
          </RequireAuth>
        }
      />
      <Route
        path="/work-items/:id"
        element={
          <RequireAuth>
            <AuthGate>
              <WorkItemDetails />
            </AuthGate>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
