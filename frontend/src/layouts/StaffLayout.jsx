import { useState } from "react";

import {
    NavLink,
    Outlet,
    useNavigate
} from "react-router-dom";

import useAuth from "../hooks/useAuth.js";
import "../styles/portal.css";

export default function StaffLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const base = `/${user.role.toLowerCase()}`;

    async function signOut() {
        setBusy(true);
        setError("");

        try {
            await logout();
            navigate("/login", { replace: true });
        } catch {
            setError(
                "Logout failed. Check the connection and retry."
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="lh-portal">
            <aside>
                <h2>LuxuryStay</h2>

                <p>
                    {user.name}
                    <br />
                    {user.role}
                </p>

                <nav>
                    <NavLink to={`${base}/dashboard`}>
                        Dashboard
                    </NavLink>

                    <NavLink to={`${base}/profile`}>
                        My profile
                    </NavLink>

                    {user.role === "Admin" && (
                        <NavLink to={`${base}/staff`}>
                            Staff & hotels
                        </NavLink>
                    )}
                </nav>

                <button
                    disabled={busy}
                    onClick={signOut}
                >
                    {busy ? "Logging out…" : "Logout"}
                </button>

                {error && <p role="alert">{error}</p>}
            </aside>

            <main className="lh-portal-content">
                <Outlet />
            </main>
        </div>
    );
}