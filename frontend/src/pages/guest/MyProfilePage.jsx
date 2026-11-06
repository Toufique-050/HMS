import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import {
    updateProfile,
    changePassword,
} from "../../features/auth/authApi.js";
import { errorMessage } from "../../api/http.js";

const initialPasswords = {
    currentPassword: "",
    newPassword: "",
    confirm: "",
};

const workspaceLabels = {
    admin: "Admin workspace",
    manager: "Manager workspace",
    receptionist: "Receptionist workspace",
    housekeeping: "Housekeeping workspace",
};

export default function MyProfilePage() {
    const { user, setUser, clearAuth } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({
        name: user?.name || "",
        phone: user?.phone || "",
    });

    const [passwords, setPasswords] = useState(initialPasswords);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    // Keep the form synchronized if the authenticated user changes.
    useEffect(() => {
        setProfile({
            name: user?.name || "",
            phone: user?.phone || "",
        });
    }, [user?.name, user?.phone]);

    function updateProfileField(event) {
        const { name, value } = event.target;

        setProfile((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    function updatePasswordField(event) {
        const { name, value } = event.target;

        setPasswords((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    async function save(event) {
        event.preventDefault();

        setError("");
        setMessage("");

        const name = profile.name.trim();
        const phone = profile.phone.trim();

        if (name.length < 2) {
            setError("Name must contain at least 2 characters.");
            return;
        }

        setBusy(true);

        try {
            const data = await updateProfile({ name, phone });

            if (data?.user) {
                setUser(data.user);
                setProfile({
                    name: data.user.name || "",
                    phone: data.user.phone || "",
                });
            }

            setMessage("Profile saved successfully.");
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    async function updatePassword(event) {
        event.preventDefault();

        setError("");
        setMessage("");

        if (passwords.newPassword !== passwords.confirm) {
            setError("New password and confirmation do not match.");
            return;
        }

        if (passwords.newPassword.length < 5) {
            setError("New password must contain at least 5 characters.");
            return;
        }

        if (passwords.newPassword.length > 72) {
            setError("New password cannot exceed 72 characters.");
            return;
        }

        setBusy(true);

        try {
            await changePassword({
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword,
            });

            clearAuth();
            navigate("/login", { replace: true });
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    const passwordFields = [
        {
            name: "currentPassword",
            label: "Current password",
            autocomplete: "current-password",
            minLength: 1,
        },
        {
            name: "newPassword",
            label: "New password",
            autocomplete: "new-password",
            minLength: 5,
        },
        {
            name: "confirm",
            label: "Confirm new password",
            autocomplete: "new-password",
            minLength: 5,
        },
    ];

    // Role ke hisaab se eyebrow text (Admin / Manager / Receptionist ...)
    const roleKey = String(user?.role || "").toLowerCase();
    const workspaceLabel = workspaceLabels[roleKey] || "Staff workspace";

    return (
        <section className="gs-profile-page">
            <header className="gs-hero">
                <div>
                    <span className="gs-eyebrow">
                        LUXURYSTAY · {workspaceLabel.toUpperCase()}
                    </span>

                    <h1>My profile</h1>

                    <p>
                        Manage your personal details and account security.
                    </p>

                    <p>
                        {user?.email || "No email available"}
                        {" · "}
                        {user?.role || "Guest"}
                    </p>
                </div>
            </header>

            {error && (
                <p className="gs-error" role="alert">
                    {error}
                </p>
            )}

            {message && (
                <p className="gs-success" role="status">
                    {message}
                </p>
            )}

            <form
                className="gs-card gs-form"
                onSubmit={save}
            >
                <h2>Personal details</h2>
                <p>Keep your contact information up to date.</p>

                <label htmlFor="profile-name">
                    Full name
                    <input
                        id="profile-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={profile.name}
                        onChange={updateProfileField}
                        disabled={busy}
                    />
                </label>

                <label htmlFor="profile-phone">
                    Phone number
                    <input
                        id="profile-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={30}
                        value={profile.phone}
                        onChange={updateProfileField}
                        disabled={busy}
                    />
                </label>

                <button
                    type="submit"
                    className="gs-button"
                    disabled={busy}
                >
                    {busy ? "Saving..." : "Save profile"}
                </button>
            </form>

            <form
                className="gs-card gs-form"
                onSubmit={updatePassword}
            >
                <h2>Change password</h2>

                <p>
                    For security, you will be signed out after changing
                    your password.
                </p>

                {passwordFields.map((field) => (
                    <label key={field.name} htmlFor={field.name}>
                        {field.label}

                        <input
                            id={field.name}
                            name={field.name}
                            type="password"
                            required
                            minLength={field.minLength}
                            maxLength={72}
                            autoComplete={field.autocomplete}
                            value={passwords[field.name]}
                            onChange={updatePasswordField}
                            disabled={busy}
                        />
                    </label>
                ))}

                <button
                    type="submit"
                    className="gs-button"
                    disabled={busy}
                >
                    {busy ? "Updating..." : "Change password"}
                </button>
            </form>
        </section>
    );
}