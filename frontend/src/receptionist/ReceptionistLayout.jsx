import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { menu } from "./config.js";
import "../styles/receptionist.css";

export default function ReceptionistLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function signOut() {
        setBusy(true); setError("");
        try { await logout(); navigate("/login", { replace: true }); }
        catch { setError("Logout failed. Please retry."); }
        finally { setBusy(false); }
    }
    return <div className="rx-shell">
        <a className="rx-skip" href="#rx-main">Skip to content</a>
        <aside className="rx-sidebar">
            <div className="rx-brand"><span className="rx-monogram">L</span><div><strong>LuxuryStay</strong><small>FRONT DESK WORKSPACE</small></div></div>
            <button type="button" className="rx-mobile-toggle" aria-expanded={open} aria-controls="rx-navigation" onClick={() => setOpen(!open)}>{open ? "Close menu" : "Open menu"}</button>
            <nav id="rx-navigation" className={open ? "rx-nav is-open" : "rx-nav"} aria-label="Receptionist navigation">
                {menu.map(([path, name], index) => <NavLink key={path} to={`/receptionist/${path}`} onClick={() => setOpen(false)}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{name}</NavLink>)}
                <NavLink to="/receptionist/profile" onClick={() => setOpen(false)}><span aria-hidden="true">10</span>My profile</NavLink>
            </nav>
            <div className="rx-user"><strong>{user.name}</strong><small>Receptionist · Assigned hotel</small><button type="button" className="rx-button rx-secondary" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="rx-error">{error}</p>}</div>
        </aside>
        <main id="rx-main" className="rx-main" tabIndex={-1}><Outlet key={location.pathname} /></main>
    </div>;
}
