import { useEffect, useState } from "react";

import http, { errorMessage } from "../../api/http.js";

import "../../styles/receptionist.css";

const money = new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2
});

function BookingList({ title, items }) {
    return (
        <section className="reception-dash__section">
            <h2>{title}</h2>

            <p className="reception-dash__hint">
                Showing up to 10 bookings.
            </p>

            {items.length === 0 ? (
                <p>No pending bookings for today.</p>
            ) : (
                <div
                    className="reception-dash__table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label={title}
                >
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Reference</th>
                                <th scope="col">Guest</th>
                                <th scope="col">Phone</th>
                                <th scope="col">Room</th>
                            </tr>
                        </thead>

                        <tbody>
                            {items.map(booking => (
                                <tr key={booking._id}>
                                    <td>{booking.reference}</td>
                                    <td>
                                        {booking.guestSnapshot?.name || "—"}
                                    </td>
                                    <td>
                                        {booking.guestSnapshot?.phone || "—"}
                                    </td>
                                    <td>
                                        {booking.roomId?.roomNumber || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export default function ReceptionistDashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function loadDashboard() {
            setLoading(true);
            setError("");

            try {
                const response = await http.get(
                    "/receptionist/dashboard",
                    { signal: controller.signal }
                );

                if (!controller.signal.aborted) {
                    setData(response.data);
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(err));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadDashboard();

        return () => controller.abort();
    }, [refreshKey]);

    const cards = data ? [
        ["Active rooms", data.stats.totalRooms],
        ["Occupied rooms", data.stats.occupiedRooms],
        ["Ready rooms", data.stats.readyRooms],
        ["Pending arrivals today", data.stats.pendingArrivals],
        ["Pending departures today", data.stats.pendingDepartures],
        [
            "Outstanding invoice balance",
            money.format(data.stats.outstandingBalance)
        ]
    ] : [];

    return (
        <div className="reception-dash" aria-busy={loading}>
            <header className="reception-dash__header">
                <div>
                    <p className="reception-dash__eyebrow">
                        FRONT DESK
                    </p>

                    <h1>Receptionist dashboard</h1>

                    {data && (
                        <p>
                            {data.hotel.name} · {data.hotel.location}
                            <br />
                            Hotel date: {data.date}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    disabled={loading}
                    onClick={() => setRefreshKey(value => value + 1)}
                >
                    {loading ? "Loading…" : "Refresh"}
                </button>
            </header>

            {error && (
                <p className="reception-dash__error" role="alert">
                    {error}
                </p>
            )}

            {loading && !data && (
                <p role="status">Loading hotel overview…</p>
            )}

            {data && (
                <>
                    <div className="reception-dash__cards">
                        {cards.map(([label, value]) => (
                            <article
                                className="reception-dash__card"
                                key={label}
                            >
                                <p>{label}</p>
                                <strong>{value}</strong>
                            </article>
                        ))}
                    </div>

                    <p className="reception-dash__hint">
                        Ready rooms show current room readiness.
                        Date availability will be checked when booking.
                        Outstanding balance includes all unpaid invoice
                        balances for this hotel.
                    </p>

                    <BookingList
                        title="Today's pending arrivals"
                        items={data.arrivals}
                    />

                    <BookingList
                        title="Today's pending departures"
                        items={data.departures}
                    />
                </>
            )}
        </div>
    );
}