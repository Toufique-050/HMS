import { useEffect, useState } from "react";

import useAuth from "../../hooks/useAuth.js";
import http, { errorMessage } from "../../api/http.js";

export default function StaffDashboardPage() {
    const { user } = useAuth();

    const [message, setMessage] = useState(
        "Checking server access…"
    );

    const [hotel, setHotel] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        (async () => {
            try {
                const { data } = await http.get(
                    `/auth/dashboard/${user.role}`
                );

                if (active) {
                    setMessage(data.message);
                }

                if (user.hotelId) {
                    const response = await http.get(
                        `/hotels/${user.hotelId}`
                    );

                    if (active) {
                        setHotel(response.data.hotel.name);
                    }
                }
            } catch (error) {
                if (active) {
                    setError(errorMessage(error));
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [user.id, user.role, user.hotelId]);

    const roleCards = {
        Admin: ["Hotel management", "Staff coordination", "Bookings & billing"],
        Manager: ["Hotel operations", "Room availability", "Team coordination"],
        Receptionist: ["Guest arrivals", "Reservations", "Guest assistance"],
        Housekeeping: ["Assigned tasks", "Room readiness", "Service requests"],
        Guest: ["My bookings", "My stay", "Service requests"],
    };
    const scope = user.role === "Admin" ? "All hotels"
        : user.role === "Guest" ? "Your own account"
        : hotel || "Assigned hotel";

    return (
        <section className="lh-role-dashboard">
            <header className="lh-role-hero">
                <div>
                    <span className="lh-role-eyebrow">LUXURYSTAY · YOUR WORKSPACE</span>
                    <h1>{user.role} Dashboard</h1>
                    <p>Welcome back, {user.name}.</p>
                    <span className="lh-role-badge">{user.role} access</span>
                </div>
                <div className="lh-role-scope">
                    <span>Your access scope</span>
                    <strong>{scope}</strong>
                    <p>Your hotel workspace, thoughtfully organized.</p>
                </div>
            </header>
            {error ? (
                <p className="error" role="alert">{error}</p>
            ) : (
                <p className="lh-role-status" role="status">{message}</p>
            )}
            <div className="lh-role-section-heading">
                <span className="lh-role-eyebrow">DAILY OPERATIONS</span>
                <h2>Your workspace</h2>
            </div>
            <div className="lh-role-grid">
                {(roleCards[user.role] || ["Hotel operations", "My tasks", "Team workspace"]).map((title, index) => (
                    <article className="lh-role-module" key={title}>
                        <span className="lh-role-number">0{index + 1}</span>
                        <h3>{title}</h3>
                        <p>This module will be available in a future update.</p>
                        <span className="lh-role-coming">Coming soon</span>
                    </article>
                ))}
            </div>
            <div className="lh-role-note">
                <h3>Workspace setup</h3>
                <p>Authentication is connected. Booking, billing and task modules will be added later.</p>
            </div>
        </section>
    );
}
