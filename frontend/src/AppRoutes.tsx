import { lazy, Suspense, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";

import { Button } from "./components/ui/Button";
import { AuthGate } from "./features/auth/AuthGate";
import { useAuth } from "./features/auth/AuthProvider";
import "./features/auth/Auth.css";

// Declare lazy components outside component functions.
const DashboardPage = lazy(() => import("./App"));

// These files use named exports, so adapt them to lazy's default shape.
const LoginPage = lazy(() =>
  import("./features/auth/LoginPage").then(module => ({
    default: module.LoginPage,
  })),
);

const WorkItemDetails = lazy(() =>
  import("./features/items/WorkItemDetails").then(module => ({
    default: module.WorkItemDetails,
  })),
);

const ConfirmEmailPage = lazy(() =>
  import("./features/auth/ConfirmEmailPage").then(module => ({
    default: module.ConfirmEmailPage,
  })),
);

function PageLoading() {
  return (
    <div className="feedback-panel" role="status">
      Loading page…
    </div>
  );
}

function PageError() {
  return (
    <section className="feedback-panel" role="alert">
      <h2>We couldn’t open this page.</h2>
      <p>Reload the application to try again.</p>

      <Button type="button" onClick={() => window.location.reload()}>
        Reload application
      </Button>
    </section>
  );
}

function PageBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundary
      FallbackComponent={PageError}
      resetKeys={[location.pathname]}
    >
      <Suspense fallback={<PageLoading />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function getReturnPath(state: unknown): string {
  if (
    typeof state !== "object" ||
    state === null ||
    !("from" in state) ||
    typeof state.from !== "string"
  ) {
    return "/work-items";
  }

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

  // Restore the session before deciding which route to show.
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
            <PageBoundary>
              <LoginPage key="login" mode="login" />
            </PageBoundary>
          </GuestOnly>
        }
      />

      <Route
        path="/register"
        element={
          <GuestOnly>
            <PageBoundary>
              <LoginPage key="register" mode="register" />
            </PageBoundary>
          </GuestOnly>
        }
      />

      <Route
        path="/work-items"
        element={
          <RequireAuth>
            <AuthGate>
              <PageBoundary>
                <DashboardPage />
              </PageBoundary>
            </AuthGate>
          </RequireAuth>
        }
      />

      <Route
        path="/work-items/:id"
        element={
          <RequireAuth>
            <AuthGate>
              <PageBoundary>
                <WorkItemDetails />
              </PageBoundary>
            </AuthGate>
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
      <Route
        path="/confirm-email"
        element={
          <PageBoundary>
            <ConfirmEmailPage />
          </PageBoundary>
        }
      />
    </Routes>
  );
}
