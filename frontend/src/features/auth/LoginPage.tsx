import {
    useRef,
    useState,
    type FormEvent,
} from "react";

import { useAuth } from "./AuthProvider";
import { register } from "./api";
import "./Auth.css";

type FormMode = "login" | "register";

export function LoginPage() {
    const { login } = useAuth();

    const [mode, setMode] = useState<FormMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const passwordRef = useRef<HTMLInputElement>(null);

    const isRegistering = mode === "register";

    function switchMode() {
        if (isSubmitting) {
            return;
        }

        setMode(previous =>
            previous === "login" ? "register" : "login",
        );

        setPassword("");
        setConfirmPassword("");
        setError(null);
        setMessage(null);
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        setError(null);
        setMessage(null);

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

                setEmail(input.email);
                setPassword("");
                setConfirmPassword("");
                setMode("login");

                setMessage(
                    "Your account is ready. Sign in to get started.",
                );
            } else {
                await login(input);
            }
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setIsSubmitting(false);

            // Focus after React renders the enabled form.
            requestAnimationFrame(() => {
                passwordRef.current?.focus();
            });
        }
    }

    return (
        <main className="auth-page auth-screen">
            <section
                className="auth-card"
                aria-labelledby="auth-heading"
            >
                <span className="eyebrow">PROJECTFORGE</span>

                <h1 id="auth-heading">
                    {isRegistering ? "Create your account." : "Welcome back."}
                </h1>

                <p className="auth-description">
                    {isRegistering
                        ? "Your next project starts here."
                        : "Sign in to your delivery workspace."}
                </p>

                {message !== null && (
                    <p className="auth-success" role="status">
                        {message}
                    </p>
                )}

                <form
                    onSubmit={handleSubmit}
                    aria-busy={isSubmitting}
                >
                    <fieldset disabled={isSubmitting}>
                        <label htmlFor="auth-email">Email</label>

                        <input
                            id="auth-email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={event =>
                                setEmail(event.target.value)
                            }
                            required
                            maxLength={254}
                        />

                        <label htmlFor="auth-password">Password</label>

                        <input
                            ref={passwordRef}
                            id="auth-password"
                            name="password"
                            type="password"
                            autoComplete={
                                isRegistering
                                    ? "new-password"
                                    : "current-password"
                            }
                            value={password}
                            onChange={event =>
                                setPassword(event.target.value)
                            }
                            required
                            minLength={isRegistering ? 12 : undefined}
                            maxLength={128}
                            aria-describedby={
                                isRegistering ? "password-help" : undefined
                            }
                        />

                        {isRegistering && (
                            <>
                                <p
                                    id="password-help"
                                    className="auth-password-help"
                                >
                                    Use at least 12 characters, including an
                                    uppercase letter, a lowercase letter,
                                    a number, and a symbol.
                                </p>

                                <label htmlFor="auth-confirm-password">
                                    Confirm password
                                </label>

                                <input
                                    id="auth-confirm-password"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={event =>
                                        setConfirmPassword(event.target.value)
                                    }
                                    required
                                    minLength={12}
                                    maxLength={128}
                                />
                            </>
                        )}

                        {error !== null && (
                            <p className="auth-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button type="submit">
                            {isSubmitting
                                ? isRegistering
                                    ? "Creating account…"
                                    : "Signing in…"
                                : isRegistering
                                    ? "Create account"
                                    : "Sign in"}
                        </button>
                    </fieldset>
                </form>

                <div className="auth-switch">
                    <span>
                        {isRegistering
                            ? "Already have an account?"
                            : "New to ProjectForge?"}
                    </span>

                    <button
                        type="button"
                        className="auth-switch-button"
                        disabled={isSubmitting}
                        onClick={switchMode}
                    >
                        {isRegistering ? "Sign in" : "Create an account"}
                    </button>
                </div>
            </section>
        </main>
    );
}