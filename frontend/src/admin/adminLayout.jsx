import { useState } from "react";

import {
    NavLink,
    Outlet,
    useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import { menu } from "./config.js";

import "./admin.css";

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function signOut() {
        setBusy(true);
        setError("");

        try {
            await logout();
            navigate("/login", { replace: true });
        } catch {
            setError("Logout failed. Please retry.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="lsa-shell">
            <header className="lsa-mobile">
                <strong>LuxuryStay · Admin</strong>

                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="lsa-navigation"
                    onClick={() => setOpen(!open)}
                >
                    {open ? "Close menu" : "Menu"}
                </button>
            </header>

            <aside
                className={
                    open
                        ? "lsa-sidebar lsa-open"
                        : "lsa-sidebar"
                }
            >
                <NavLink
                    className="lsa-brand"
                    to="/admin/dashboard"
                >
                    LuxuryStay
                    <span>ADMINISTRATION</span>
                </NavLink>

                <p>
                    {user?.name}
                    <small>All hotels · Admin access</small>
                </p>

                <nav
                    id="lsa-navigation"
                    aria-label="Admin navigation"
                >
                    {menu.map(([path, title], index) => (
                        <NavLink
                            key={path}
                            to={`/admin/${path}`}
                            onClick={() => setOpen(false)}
                        >
                            <span>
                                {String(index + 1).padStart(2, "0")}
                            </span>

                            {title}
                        </NavLink>
                    ))}

                    <NavLink
                        to="/admin/profile"
                        onClick={() => setOpen(false)}
                    >
                        My profile
                    </NavLink>
                </nav>

                <button
                    type="button"
                    disabled={busy}
                    onClick={signOut}
                >
                    {busy ? "Signing out…" : "Sign out"}
                </button>

                {error && (
                    <p role="alert">{error}</p>
                )}
            </aside>

            <main className="lsa-main">
                <Outlet />
            </main>
        </div>
    );
}