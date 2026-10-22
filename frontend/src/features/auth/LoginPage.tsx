import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import { useRef, useState, type FormEvent } from "react";

import { Link, useLocation, useNavigate } from "react-router";

import { useAuth } from "./AuthProvider";
import { register } from "./api";

import "./Auth.css";

type LoginPageProps = {
  mode: "login" | "register";
};

type AuthNavigationState = {
  from?: string;
  email?: string;
  notice?: string;
};

export function LoginPage({ mode }: LoginPageProps) {
  const { login } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  // This state is supplied by our own route redirects.
  const navigationState = location.state as AuthNavigationState | null;

  const [email, setEmail] = useState(navigationState?.email ?? "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  const isRegistering = mode === "register";

  const notice = isRegistering ? null : navigationState?.notice;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError(null);

    if (isRegistering && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const input = {
        email: email.trim(),
        password,
      };

      if (isRegistering) {
        await register(input);

        navigate("/login", {
          replace: true,
          state: {
            from: navigationState?.from,
            email: input.email,
            notice: "Your account is ready. Sign in to get started.",
          } satisfies AuthNavigationState,
        });
      } else {
        await login(input);

        // The public-route guard redirects after auth state changes.
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Please try again.",
      );

      requestAnimationFrame(() => {
        passwordRef.current?.focus();
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-screen">
      <section className="auth-card panel" aria-labelledby="auth-heading">
        <span className="eyebrow">PROJECTFORGE</span>

        <h1 id="auth-heading">
          {isRegistering ? "Create your account." : "Welcome back."}
        </h1>

        <p className="auth-description">
          {isRegistering
            ? "Your next project starts here."
            : "Sign in to your delivery workspace."}
        </p>

        {notice && (
          <p className="notice notice--success" role="status">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <fieldset className="form-stack" disabled={isSubmitting}>
            <FormField htmlFor="auth-email" label="Email">
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
              />
            </FormField>

            <FormField
              htmlFor="auth-password"
              label="Password"
              hint={
                isRegistering
                  ? "Use at least 12 characters, including an uppercase letter, a lowercase letter, a number, and a symbol."
                  : undefined
              }
            >
              <input
                ref={passwordRef}
                id="auth-password"
                name="password"
                type="password"
                autoComplete={
                  isRegistering ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={isRegistering ? 12 : undefined}
                maxLength={128}
                aria-describedby={
                  isRegistering ? "auth-password-help" : undefined
                }
              />
            </FormField>

            {isRegistering && (
              <>
                <FormField
                  htmlFor="auth-confirm-password"
                  label="Confirm password"
                >
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </FormField>
              </>
            )}

            {error !== null && (
              <p className="notice notice--error" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              isLoading={isSubmitting}
              loadingText={isRegistering ? "Creating account…" : "Signing in…"}
            >
              {isRegistering ? "Create account" : "Sign in"}
            </Button>
          </fieldset>
        </form>

        <div className="auth-switch">
          <span>
            {isRegistering
              ? "Already have an account?"
              : "New to ProjectForge?"}
          </span>

          {isSubmitting ? (
            <span>Please wait…</span>
          ) : (
            <Link
              className="text-link"
              to={isRegistering ? "/login" : "/register"}
              state={
                {
                  from: navigationState?.from,
                  email,
                } satisfies AuthNavigationState
              }
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
