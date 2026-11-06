import { useState } from "react";

import {
    Link,
    Navigate,
    useNavigate,
    useSearchParams
} from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import { dashboardPath } from "../../constants/roles.js";
import { errorMessage } from "../../api/http.js";
import "../../styles/Auth.css";

export default function LoginPage() {
    const { user, loading, login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [form, setForm] = useState({
        email: "",
        password: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const registered = searchParams.get("registered") === "1";

    function updateField(event) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError("");
    }

    async function submit(event) {
        event.preventDefault();

        if (busy) return;

        setError("");

        if (form.password.length < 5) {
            setError("Password must contain at least 5 characters.");
            return;
        }

        if (new TextEncoder().encode(form.password).length > 72) {
            setError("Password must be at most 72 UTF-8 bytes.");
            return;
        }

        setBusy(true);

        try {
            const account = await login({
                email: form.email.trim().toLowerCase(),
                password: form.password
            });

            navigate(dashboardPath(account.role), {
                replace: true
            });
        } catch (caughtError) {
            setError(errorMessage(caughtError));
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return (
            <main className="lh-login-loading" role="status">
                Loading your account…
            </main>
        );
    }

    if (user) {
        return (
            <Navigate
                to={dashboardPath(user.role)}
                replace
            />
        );
    }

    return (
        <main className="lh-login-page">
            <section
                className="lh-login-shell"
                aria-labelledby="login-title"
            >
                <aside className="lh-login-story">
                    <Link to="/" className="lh-login-brand">
                        <span
                            className="lh-login-brand-icon"
                            aria-hidden="true"
                        >
                            L
                        </span>

                        LuxuryStay
                    </Link>

                    <div className="lh-login-story-content">
                        <span className="lh-login-eyebrow">
                            A WARM WELCOME BACK
                        </span>

                        <h2>
                            Your space.
                            <br />
                            Your next chapter.
                        </h2>

                        <p>
                            From your next getaway to the daily
                            rhythm of hospitality, your LuxuryStay
                            account brings everything closer.
                        </p>

                        <div className="lh-login-welcome-card">
                            <span
                                className="lh-login-welcome-icon"
                                aria-hidden="true"
                            >
                                ✦
                            </span>

                            <div>
                                <strong>One account. Your own space.</strong>

                                <p>
                                    Sign in and we will take you to
                                    the dashboard assigned to your role.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="lh-login-story-footer">
                        <span aria-hidden="true">✓</span>
                        Thoughtful hospitality starts with you.
                    </div>
                </aside>

                <div className="lh-login-panel">
                    <Link to="/" className="lh-login-back">
                        <span aria-hidden="true">←</span>
                        Back to home
                    </Link>

                    <header className="lh-login-heading">
                        <span className="lh-login-eyebrow">
                            YOUR LUXURYSTAY ACCOUNT
                        </span>

                        <h1 id="login-title">Welcome back</h1>

                        <p>
                            Enter your details to continue to
                            your dashboard.
                        </p>
                    </header>

                    {registered && (
                        <div
                            className="lh-login-success"
                            role="status"
                        >
                            <span aria-hidden="true">✓</span>

                            <p>
                                Your account has been created.
                                You can now log in.
                            </p>
                        </div>
                    )}

                    <form
                        className="lh-login-form"
                        onSubmit={submit}
                        aria-busy={busy}
                    >
                        <fieldset disabled={busy}>
                            <div className="lh-login-field">
                                <label htmlFor="login-email">
                                    Email address
                                </label>

                                <input
                                    id="login-email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    maxLength={254}
                                    value={form.email}
                                    onChange={updateField}
                                    required
                                />
                            </div>

                            <div className="lh-login-field">
                                <label htmlFor="login-password">
                                    Password
                                </label>

                                <div className="lh-login-password">
                                    <input
                                        id="login-password"
                                        name="password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        minLength={5}
                                        maxLength={72}
                                        value={form.password}
                                        onChange={updateField}
                                        required
                                    />

                                    <button
                                        type="button"
                                        className="lh-login-toggle"
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        aria-pressed={showPassword}
                                        aria-controls="login-password"
                                        onClick={() =>
                                            setShowPassword(previous => !previous)
                                        }
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p
                                    className="lh-login-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="lh-login-submit"
                                disabled={busy}
                            >
                                {busy ? "Signing in…" : "Log in"}

                                {!busy && (
                                    <span aria-hidden="true">→</span>
                                )}
                            </button>
                        </fieldset>
                    </form>

                    <div className="lh-login-divider">
                        <span>New to LuxuryStay?</span>
                    </div>

                    <Link
                        to="/register"
                        className="lh-login-register"
                    >
                        Create a guest account
                    </Link>

                    <div className="lh-login-staff-note">
                        <span aria-hidden="true">✦</span>

                        <p>
                            <strong>Hotel staff?</strong> Use the
                            email and password provided by your Admin.
                        </p>
                    </div>

                    <footer className="lh-login-panel-footer">
                        <Link to="/policies">Policies & FAQs</Link>
                        <span aria-hidden="true">·</span>
                        <Link to="/contact">Contact us</Link>
                    </footer>
                </div>
            </section>
        </main>
    );
}