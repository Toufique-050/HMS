import { useState } from "react";
import {
    Link,
    Navigate,
    useNavigate
} from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import { signUp } from "../../features/auth/authApi.js";
import { errorMessage } from "../../api/http.js";
import { dashboardPath } from "../../constants/roles.js";
import "../../styles/Auth.css";

export default function RegisterPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirm: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

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

        if (form.name.trim().length < 2) {
            setError("Full name must contain at least 2 characters.");
            return;
        }

        if (form.password.length < 5) {
            setError("Password must contain at least 5 characters.");
            return;
        }

        if (form.password !== form.confirm) {
            setError("Passwords do not match.");
            return;
        }

        const passwordBytes = new TextEncoder()
            .encode(form.password).length;

        if (passwordBytes > 72) {
            setError("Password must be at most 72 UTF-8 bytes.");
            return;
        }

        setBusy(true);

        try {
            await signUp({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim(),
                password: form.password
            });

            navigate("/login?registered=1", {
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
            <main className="lh-register-loading" role="status">
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
        <main className="lh-register-page">
            <section
                className="lh-register-shell"
                aria-labelledby="register-title"
            >
                <aside className="lh-register-story">
                    <Link to="/" className="lh-register-brand">
                        <span
                            className="lh-register-brand-icon"
                            aria-hidden="true"
                        >
                            L
                        </span>

                        LuxuryStay
                    </Link>

                    <div className="lh-register-story-content">
                        <span className="lh-register-eyebrow">
                            YOUR NEXT STAY STARTS HERE
                        </span>

                        <h2>
                            A little comfort.
                            <br />
                            A memorable stay.
                        </h2>

                        <p>
                            Create your guest account and enjoy a
                            personal space for your hotel journey.
                        </p>

                        <ul className="lh-register-benefits">
                            <li>
                                <span aria-hidden="true">✓</span>
                                Your own guest dashboard
                            </li>

                            <li>
                                <span aria-hidden="true">✓</span>
                                An account made for your stays
                            </li>

                            <li>
                                <span aria-hidden="true">✓</span>
                                Easy access to your profile
                            </li>
                        </ul>
                    </div>

                    <div className="lh-register-story-footer">
                        <span aria-hidden="true">✦</span>
                        Thoughtful hospitality, from the first hello.
                    </div>
                </aside>

                <div className="lh-register-panel">
                    <Link to="/" className="lh-register-back">
                        <span aria-hidden="true">←</span>
                        Back to home
                    </Link>

                    <header className="lh-register-heading">
                        <span className="lh-register-eyebrow">
                            WELCOME TO LUXURYSTAY
                        </span>

                        <h1 id="register-title">
                            Create your account
                        </h1>

                        <p>
                            Already a member?{" "}
                            <Link to="/login">Log in</Link>
                        </p>
                    </header>

                    <div className="lh-register-account-note">
                        <span aria-hidden="true">✦</span>

                        <p>
                            You are registering as a <strong>Guest</strong>.
                            Staff accounts are created by the hotel Admin.
                        </p>
                    </div>

                    <form
                        className="lh-register-form"
                        onSubmit={submit}
                        aria-busy={busy}
                    >
                        <fieldset disabled={busy}>
                            <div className="lh-register-field">
                                <label htmlFor="register-name">
                                    Full name
                                </label>

                                <input
                                    id="register-name"
                                    name="name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Enter your full name"
                                    minLength={2}
                                    maxLength={80}
                                    value={form.name}
                                    onChange={updateField}
                                    required
                                />
                            </div>

                            <div className="lh-register-field">
                                <label htmlFor="register-email">
                                    Email address
                                </label>

                                <input
                                    id="register-email"
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

                            <div className="lh-register-field">
                                <label htmlFor="register-phone">
                                    Phone number
                                    <span>Optional</span>
                                </label>

                                <input
                                    id="register-phone"
                                    name="phone"
                                    type="tel"
                                    autoComplete="tel"
                                    placeholder="e.g. +92 300 1234567"
                                    maxLength={30}
                                pattern="[+()0-9\\s\\x2d]*"
                                    title="Use digits, spaces, +, parentheses or hyphens."
                                    value={form.phone}
                                    onChange={updateField}
                                />
                            </div>

                            <div className="lh-register-field">
                                <label htmlFor="register-password">
                                    Password
                                </label>

                                <div className="lh-register-password">
                                    <input
                                        id="register-password"
                                        name="password"
                                        type={
                                            showPassword
                                                ? "text"
                                                : "password"
                                        }
                                        autoComplete="new-password"
                                        placeholder="Create a password"
                                        minLength={5}
                                        maxLength={72}
                                        aria-describedby="register-password-hint"
                                        value={form.password}
                                        onChange={updateField}
                                        required
                                    />

                                    <button
                                        type="button"
                                        className="lh-register-toggle"
                                        aria-label={
                                            showPassword
                                                ? "Hide password"
                                                : "Show password"
                                        }
                                        aria-pressed={showPassword}
                                        aria-controls="register-password"
                                        onClick={() =>
                                            setShowPassword(previous => !previous)
                                        }
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>

                                <small id="register-password-hint">
                                    Use at least 5 characters.
                                </small>
                            </div>

                            <div className="lh-register-field">
                                <label htmlFor="register-confirm">
                                    Confirm password
                                </label>

                                <div className="lh-register-password">
                                    <input
                                        id="register-confirm"
                                        name="confirm"
                                        type={
                                            showConfirm
                                                ? "text"
                                                : "password"
                                        }
                                        autoComplete="new-password"
                                        placeholder="Enter your password again"
                                        minLength={5}
                                        maxLength={72}
                                        value={form.confirm}
                                        onChange={updateField}
                                        required
                                    />

                                    <button
                                        type="button"
                                        className="lh-register-toggle"
                                        aria-label={
                                            showConfirm
                                                ? "Hide confirm password"
                                                : "Show confirm password"
                                        }
                                        aria-pressed={showConfirm}
                                        aria-controls="register-confirm"
                                        onClick={() =>
                                            setShowConfirm(previous => !previous)
                                        }
                                    >
                                        {showConfirm ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p
                                    className="lh-register-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="lh-register-submit"
                                disabled={busy}
                            >
                                {busy
                                    ? "Creating your account…"
                                    : "Create guest account"}

                                {!busy && (
                                    <span aria-hidden="true">→</span>
                                )}
                            </button>
                        </fieldset>

                        <p className="lh-register-policy">
                            Before registering, you can review our{" "}
                            <Link to="/policies">
                                policies and FAQs
                            </Link>.
                        </p>
                    </form>

                    <footer className="lh-register-panel-footer">
                        A warm welcome awaits you.
                    </footer>
                </div>
            </section>
        </main>
    );
}