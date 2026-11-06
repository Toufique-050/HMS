
import { useEffect, useState } from "react";

import {
    NavLink,
    Outlet,
    useLocation,
    useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import Navbar from "../components/navigation/Navbar.jsx";

import "../styles/guest.css";

const menu = [
    ["dashboard", "Dashboard"],
    ["new-booking", "New booking"],
    ["bookings", "My bookings"],
    ["services", "Service requests"],
    ["maintenance", "Maintenance requests"],
    ["invoices", "My invoices"],
    ["notifications", "Notifications"],
    ["profile", "My profile"]
];

export default function GuestLayout() {
    const { user, logout } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        try {
            const path = sessionStorage.getItem(
                "luxurystay_booking_return"
            );

            sessionStorage.removeItem(
                "luxurystay_booking_return"
            );

            if (
                path &&
                /^\/rooms\/[a-f\d]{24}(\?.*)?$/i.test(path)
            ) {
                navigate(path, {
                    replace: true
                });
            }
        } catch {
            // Restricted storage must not break navigation.
        }
    }, [navigate]);

    async function signOut() {
        if (busy) return;

        setBusy(true);
        setError("");

        try {
            await logout();

            navigate("/login", {
                replace: true
            });
        } catch {
            setError(
                "Unable to sign out. Please retry."
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Navbar />

            <div className="gs-shell">
                <a
                    className="gs-skip"
                    href="#guest-main"
                >
                    Skip to content
                </a>

                <aside className="gs-sidebar">
                    <NavLink
                        className="gs-brand"
                        to="/"
                    >
                        LuxuryStay

                        <small>
                            YOUR STAY, THOUGHTFULLY MANAGED
                        </small>
                    </NavLink>

                    <button
                        type="button"
                        className="gs-button gs-secondary gs-menu"
                        aria-expanded={open}
                        aria-controls="guest-navigation"
                        onClick={() =>
                            setOpen(value => !value)
                        }
                    >
                        {open ? "Close menu" : "Open menu"}
                    </button>

                    <nav
                        id="guest-navigation"
                        className={
                            open
                                ? "gs-nav is-open"
                                : "gs-nav"
                        }
                        aria-label="Guest navigation"
                    >
                        {menu.map(([path, title]) => (
                            <NavLink
                                key={path}
                                to={`/guest/${path}`}
                                onClick={() => setOpen(false)}
                            >
                                {title}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="gs-user">
                        <strong>
                            {user?.name || "Guest"}
                        </strong>

                        <p>Guest account</p>

                        <button
                            type="button"
                            className="gs-button gs-secondary"
                            disabled={busy}
                            onClick={signOut}
                        >
                            {busy
                                ? "Signing out…"
                                : "Sign out"}
                        </button>

                        {error && (
                            <p role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                </aside>

                <main
                    id="guest-main"
                    className="gs-main"
                    tabIndex={-1}
                >
                    <Outlet key={location.pathname} />
                </main>
            </div>
        </>
    );
}
