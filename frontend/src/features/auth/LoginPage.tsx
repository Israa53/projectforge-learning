import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        if (isSubmitting) {
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            await login({
                email: email.trim(),
                password,
            });
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Could not sign in.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <span className="eyebrow">PROJECTFORGE</span>

                <h1>Welcome back.</h1>

                <p className="auth-description">
                    Sign in to your delivery workspace.
                </p>

                <form onSubmit={handleSubmit}>
                    <fieldset disabled={isSubmitting}>
                        <label htmlFor="login-email">Email</label>

                        <input
                            id="login-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            required
                            maxLength={254}
                        />

                        <label htmlFor="login-password">Password</label>

                        <input
                            id="login-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            required
                            maxLength={128}
                        />

                        {error !== null && (
                            <p className="auth-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button type="submit">
                            {isSubmitting ? "Signing in…" : "Sign in"}
                        </button>
                    </fieldset>
                </form>

                <p className="auth-description">
                    Use the account you registered in Swagger.
                </p>
            </section>
        </main>
    );
}