import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import http, { errorMessage } from "../api/http.js";

function deadlineText(value) {
    if (!value) return "Unavailable";

    return new Date(value).toLocaleString("en-PK", {
        timeZone: "Asia/Karachi"
    });
}

function timeRemaining(expiresAt, now) {
    if (!expiresAt) return "Deadline unavailable";

    const milliseconds =
        new Date(expiresAt).getTime() - now;

    if (milliseconds <= 0) {
        return "Approval window expired";
    }

    const minutes = Math.ceil(
        milliseconds / 60000
    );

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${hours}h ${remainingMinutes}m remaining`;
}

export default function PendingApprovalNotice() {
    const location = useLocation();

    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const controller = new AbortController();
        let timer;

        async function load() {
            try {
                const response = await http.get(
                    "/guest/bookings",
                    {
                        params: {
                            status: "pending_approval",
                            page: 1,
                            limit: 5
                        },
                        signal: controller.signal
                    }
                );

                if (controller.signal.aborted) return;

                setItems(response.data.items);
                setTotal(response.data.total);
                setError("");
                setNow(Date.now());
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);

                    timer = setTimeout(
                        load,
                        60000
                    );
                }
            }
        }

        setLoading(true);
        load();

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [location.pathname, refresh]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    if (loading && !items.length) {
        return (
            <p role="status">
                Checking pending reservations…
            </p>
        );
    }

    if (!total && !error) {
        return null;
    }

    return (
        <section
            className="gs-card"
            aria-labelledby="pending-approval-heading"
            style={{
                marginBottom: 24,
                border: "1px solid #d9bf77",
                background: "#fffaf0"
            }}
        >
            <h2 id="pending-approval-heading">
                Reservations awaiting approval
            </h2>

            <p>
                Requests must be approved within
                24 hours of submission. Unapproved,
                unpaid requests are automatically
                cancelled after that window.
            </p>

            <p>
                Select your payment option in
                Booking Details. Selecting an online
                demo method does not charge money
                or mark your invoice paid.
            </p>

            {error && (
                <p className="gs-error" role="alert">
                    Pending requests could not be refreshed:
                    {" "}
                    {error}
                </p>
            )}

            {items.map(booking => {
                const deadlinePassed =
                    booking.approvalExpired ||
                    (
                        booking.approvalExpiresAt &&
                        now >= new Date(
                            booking.approvalExpiresAt
                        ).getTime()
                    );

                return (
                    <article
                        key={booking._id}
                        style={{
                            borderTop: "1px solid #e4d7b7",
                            paddingTop: 16,
                            marginTop: 16
                        }}
                    >
                        <h3>{booking.reference}</h3>

                        <p>
                            {booking.hotelId?.name || "Hotel"}
                        </p>

                        <p>
                            Approval deadline:{" "}
                            <strong>
                                {deadlineText(
                                    booking.approvalExpiresAt
                                )}
                            </strong>
                            {" · Asia/Karachi"}
                        </p>

                        <p>
                            {deadlinePassed
                                ? "Approval window expired. Automatic cancellation is pending. You can also cancel this request from Booking Details."
                                : timeRemaining(
                                    booking.approvalExpiresAt,
                                    now
                                )}
                        </p>

                        <Link
                            className="gs-button gs-secondary"
                            to={`/guest/bookings/${booking._id}`}
                        >
                            Booking details / payment option
                        </Link>
                    </article>
                );
            })}

            {total > items.length && (
                <p>
                    Showing {items.length} of {total}
                    {" pending requests. "}
                    <Link to="/guest/bookings">
                        View all bookings
                    </Link>
                </p>
            )}

            <div className="gs-actions">
                <button
                    type="button"
                    className="gs-button gs-secondary"
                    disabled={loading}
                    onClick={() =>
                        setRefresh(value => value + 1)
                    }
                >
                    {loading
                        ? "Refreshing…"
                        : "Refresh pending requests"}
                </button>
            </div>

            <p>
                This notice refreshes every minute.
                Automatic expiry runs while the
                backend is running.
            </p>
        </section>
    );
}