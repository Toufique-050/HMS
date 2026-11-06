import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { menu } from "./config.js";
import "../styles/manager.css";

export default function ManagerLayout() {
    const { user, logout } = useAuth();
    const location = useLocation(), navigate = useNavigate();
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function signOut() {
        setBusy(true); setError("");
        try { await logout(); navigate("/login", { replace: true }); }
        catch { setError("Logout failed. Check the connection and retry."); }
        finally { setBusy(false); }
    }
    return <div className="rx-shell manager-shell">
        <a className="rx-skip" href="#manager-main">Skip to content</a>
        <aside className="rx-sidebar">
            <div className="rx-brand"><span className="rx-monogram">L</span><div><strong>LuxuryStay</strong><small>HOTEL MANAGEMENT</small></div></div>
            <button type="button" className="rx-mobile-toggle" aria-expanded={open} aria-controls="manager-navigation" onClick={() => setOpen(!open)}>{open ? "Close menu" : "Open menu"}</button>
            <nav id="manager-navigation" className={open ? "rx-nav is-open" : "rx-nav"} aria-label="Manager navigation">
                {menu.map(([path, title], index) => <NavLink key={path} to={`/manager/${path}`} onClick={() => setOpen(false)}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{title}</NavLink>)}
                <NavLink to="/manager/profile" onClick={() => setOpen(false)}><span aria-hidden="true">13</span>My profile</NavLink>
            </nav>
            <div className="rx-user"><strong>{user.name}</strong><small>Manager · Assigned hotel only</small><button className="rx-button rx-secondary" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="rx-error">{error}</p>}</div>
        </aside>
        <main id="manager-main" className="rx-main" tabIndex={-1}><Outlet key={location.pathname} /></main>
    </div>;
}
