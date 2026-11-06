import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { menu } from "./config.js";
import "../styles/housekeeping.css";

export default function HousekeepingLayout() {
    const { user, logout } = useAuth();
    const location = useLocation(), navigate = useNavigate();
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function signOut() {
        setBusy(true); setError("");
        try { await logout(); navigate("/login", { replace: true }); }
        catch { setError("Logout failed. Check the connection and retry."); }
        finally { setBusy(false); }
    }
    return <div className="rx-shell hk-shell">
        <a className="rx-skip" href="#housekeeping-main">Skip to content</a>
        <aside className="rx-sidebar">
            <div className="rx-brand"><span className="rx-monogram">L</span><div><strong>LuxuryStay</strong><small>ROOM CARE</small></div></div>
            <button type="button" className="rx-mobile-toggle" aria-expanded={open} aria-controls="housekeeping-navigation" onClick={() => setOpen(!open)}>{open ? "Close menu" : "Open menu"}</button>
            <nav id="housekeeping-navigation" className={open ? "rx-nav is-open" : "rx-nav"} aria-label="Housekeeping navigation">
                {menu.map(([path, title], index) => <NavLink key={path} to={`/housekeeping/${path}`} onClick={() => setOpen(false)}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{title}</NavLink>)}
                <NavLink to="/housekeeping/profile" onClick={() => setOpen(false)}><span aria-hidden="true">05</span>My profile</NavLink>
            </nav>
            <div className="rx-user"><strong>{user.name}</strong><small>Housekeeping · Assigned hotel only</small><button className="rx-button rx-secondary" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="rx-error">{error}</p>}</div>
        </aside>
        <main id="housekeeping-main" className="rx-main" tabIndex={-1}><Outlet key={location.pathname} /></main>
    </div>;
}
