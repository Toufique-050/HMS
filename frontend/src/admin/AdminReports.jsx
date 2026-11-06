import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import http, { errorMessage } from "../api/http.js";
import { money } from "./config.js";

import useHotelRealtime from "../hooks/useHotelRealtime.js";

import OccupancyChart from "../components/charts/OccupancyChart.jsx";
import RevenueChart from "../components/charts/RevenueChart.jsx";
import ForecastChart from "../components/charts/ForecastChart.jsx";

export default function AdminReports({ overview = false }) {
    const liveRevision = useHotelRealtime();

    const [hotels, setHotels] = useState([]);

    const [filters, setFilters] = useState({
        hotelId: "",
        from: "",
        to: ""
    });

    const [applied, setApplied] = useState({});
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    // Load hotels for the hotel filter.
    useEffect(() => {
        const controller = new AbortController();

        http.get("/admin/hotels", {
            params: { limit: 500 },
            signal: controller.signal
        })
            .then(response => {
                setHotels(response.data.items);
            })
            .catch(caught => {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            });

        return () => controller.abort();
    }, []);

    // Load reports when filters or real-time data change.
    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError("");

        http.get("/admin/reports", {
            params: applied,
            signal: controller.signal
        })
            .then(response => {
                setData(response.data);
            })
            .catch(caught => {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [applied, liveRevision]);

    async function download() {
        setBusy(true);
        setError("");

        try {
            const response = await http.get(
                "/admin/reports.csv",
                {
                    params: applied,
                    responseType: "blob"
                }
            );

            const url = URL.createObjectURL(response.data);
            const link = document.createElement("a");

            link.href = url;
            link.download = "LuxuryStay_Daily_Report.csv";

            document.body.append(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        } catch {
            setError("Report export failed. Please retry.");
        } finally {
            setBusy(false);
        }
    }

    function applyFilters(event) {
        event.preventDefault();

        const selectedFilters = Object.fromEntries(
            Object.entries(filters).filter(
                ([, value]) => value !== ""
            )
        );

        setApplied(selectedFilters);
    }

    const daily = Array.isArray(data?.daily)
        ? data.daily
        : [];

    const feedback = Array.isArray(data?.feedback)
        ? data.feedback
        : [];

    const stats = data
        ? [
            ["Hotels", data.hotels],
            ["Room inventory", data.rooms],
            ["Active staff", data.staff],
            ["Reservations in period", data.bookings],
            ["Reserved occupancy", `${data.occupancyPercent}%`],
            ["Currently checked in (period)", data.checkedIn],
            ["Invoiced in period", money(data.invoiced)],
            ["Collected in period", money(data.collected)],
            ["All outstanding balances", money(data.outstanding)],
            ["Open cleaning tasks", data.cleaning],
            ["Open maintenance", data.maintenance],
            [
                "Recent average rating",
                data.averageRating == null
                    ? "No feedback"
                    : `${data.averageRating}/5`
            ]
        ]
        : [];

    return (
        <section aria-busy={loading}>
            {/* Page heading */}
            <div className="lsa-heading">
                <div>
                    <span className="lsa-eyebrow">
                        ALL HOTELS · LIVE DATABASE
                    </span>

                    <h1>
                        {overview
                            ? "Administration overview"
                            : "Reports & analytics"}
                    </h1>

                    <p>
                        Reservations, collections and operations
                        in one place.
                    </p>
                </div>

                <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                        setApplied(current => ({
                            ...current
                        }));
                    }}
                >
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <form
                className="lsa-card lsa-toolbar"
                onSubmit={applyFilters}
            >
                <label>
                    Hotel

                    <select
                        value={filters.hotelId}
                        onChange={event => {
                            setFilters(current => ({
                                ...current,
                                hotelId: event.target.value
                            }));
                        }}
                    >
                        <option value="">
                            All hotels
                        </option>

                        {hotels.map(hotel => (
                            <option
                                key={hotel._id}
                                value={hotel._id}
                            >
                                {hotel.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    From

                    <input
                        type="date"
                        value={filters.from}
                        onChange={event => {
                            setFilters(current => ({
                                ...current,
                                from: event.target.value
                            }));
                        }}
                    />
                </label>

                <label>
                    To

                    <input
                        type="date"
                        value={filters.to}
                        onChange={event => {
                            setFilters(current => ({
                                ...current,
                                to: event.target.value
                            }));
                        }}
                    />
                </label>

                <button
                    type="submit"
                    disabled={loading}
                >
                    Apply filters
                </button>

                <button
                    type="button"
                    disabled={!data || loading || busy}
                    onClick={download}
                >
                    {busy ? "Exporting…" : "Export CSV"}
                </button>
            </form>

            {error && (
                <p className="lsa-error" role="alert">
                    {error}
                </p>
            )}

            {loading ? (
                <p role="status">
                    Loading report…
                </p>
            ) : data && (
                <>
                    <p className="lsa-hint">
                        Period: {data.from} to {data.to}
                        {" · "}
                        Currency: PKR
                        {" · "}
                        Hotel timezone: Asia/Karachi
                    </p>

                    {/* Summary cards */}
                    <div className="lsa-stats">
                        {stats.map(([title, value]) => (
                            <article
                                className="lsa-card"
                                key={title}
                            >
                                <span>{title}</span>
                                <strong>{value}</strong>
                            </article>
                        ))}
                    </div>

                    {/* Dashboard quick actions */}
                    {overview && (
                        <div className="lsa-card lsa-quick">
                            <h2>Quick actions</h2>

                            <Link to="/admin/bookings">
                                Manage reservations
                            </Link>

                            <Link to="/admin/rooms">
                                Review room readiness
                            </Link>

                            <Link to="/admin/invoices">
                                Record payments
                            </Link>

                            <Link to="/admin/housekeeping">
                                Assign cleaning
                            </Link>
                        </div>
                    )}

                    {/* Forecast */}
                    <div className="lsa-card">
                        <h2>Demand forecast</h2>

                        <ForecastChart
                            forecast={data.forecast}
                        />
                    </div>

                    {/* Occupancy chart */}
                    <div className="lsa-card">
                        <h2>Daily reserved occupancy</h2>

                        <OccupancyChart daily={daily} />
                    </div>

                    {/* Collections chart */}
                    <div className="lsa-card">
                        <h2>Daily collections</h2>

                        <RevenueChart daily={daily} />
                    </div>

                    {/* Exact daily values */}
                    <div className="lsa-card lsa-table-scroll">
                        <h2>Daily breakdown</h2>

                        <table>
                            <thead>
                                <tr>
                                    <th scope="col">
                                        Date
                                    </th>

                                    <th scope="col">
                                        Reserved room nights
                                    </th>

                                    <th scope="col">
                                        Reserved occupancy
                                    </th>

                                    <th scope="col">
                                        Collections
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {daily.map(day => (
                                    <tr key={day.date}>
                                        <td>{day.date}</td>
                                        <td>{day.reservedNights}</td>
                                        <td>{day.occupancyPercent}%</td>
                                        <td>{money(day.collected)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Feedback */}
                    <div className="lsa-card">
                        <h2>Guest feedback</h2>

                        {feedback.length > 0 ? (
                            feedback.map(review => (
                                <article
                                    className="lsa-review"
                                    key={review._id}
                                >
                                    <strong>
                                        {review.rating}/5
                                    </strong>

                                    <p>
                                        {review.comment ||
                                            "No comment provided."}
                                    </p>

                                    <small>
                                        {new Date(
                                            review.createdAt
                                        ).toLocaleDateString(
                                            "en-PK",
                                            {
                                                timeZone: "Asia/Karachi"
                                            }
                                        )}
                                    </small>
                                </article>
                            ))
                        ) : (
                            <p>
                                No feedback available. Reviews
                                appear after guests submit feedback
                                for completed stays.
                            </p>
                        )}
                    </div>

                    {data.note && (
                        <p className="lsa-hint">
                            {data.note}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}