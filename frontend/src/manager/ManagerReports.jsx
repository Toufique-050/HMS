import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import http, { errorMessage } from "../api/http.js";
import { hotelToday, money } from "../receptionist/config.js";

import useHotelRealtime from "../hooks/useHotelRealtime.js";

import OccupancyChart from "../components/charts/OccupancyChart.jsx";
import RevenueChart from "../components/charts/RevenueChart.jsx";
import ForecastChart from "../components/charts/ForecastChart.jsx";

export default function ManagerReports({ overview = false }) {
    const liveRevision = useHotelRealtime();

    const [filters, setFilters] = useState({
        from: "",
        to: hotelToday()
    });

    const [applied, setApplied] = useState({});
    const [data, setData] = useState(null);
    const [hotel, setHotel] = useState(null);
    const [overviewData, setOverviewData] = useState(null);

    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError("");

        (async () => {
            try {
                const [report, dashboard] = await Promise.all([
                    http.get("/manager/reports", {
                        signal: controller.signal,
                        params: applied
                    }),

                    http.get("/manager/dashboard", {
                        signal: controller.signal
                    })
                ]);

                if (!controller.signal.aborted) {
                    setData(report.data);
                    setHotel(dashboard.data.hotel);
                    setOverviewData(dashboard.data);
                }
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        })();

        return () => controller.abort();
    }, [applied, liveRevision]);

    async function download() {
        setExporting(true);
        setError("");

        try {
            const result = await http.get(
                "/manager/reports.csv",
                {
                    params: applied,
                    responseType: "blob"
                }
            );

            const url = URL.createObjectURL(result.data);
            const link = document.createElement("a");

            link.href = url;
            link.download =
                `LuxuryStay_Hotel_Report_${data.from}_${data.to}.csv`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        } catch {
            setError("Report export failed. Please retry.");
        } finally {
            setExporting(false);
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
            ["Active rooms", data.rooms],
            ["Occupied now", data.occupiedNow],
            ["Active hotel staff", data.staff],
            ["Reservations in period", data.bookings],
            [
                "Reserved occupancy proxy",
                `${data.occupancyPercent}%`
            ],
            ["Invoiced in period", money(data.invoiced)],
            ["Collected in period", money(data.collected)],
            ["All outstanding balances", money(data.outstanding)],
            ["Unfinished cleaning", data.cleaning],
            ["Unresolved maintenance", data.maintenance],
            [
                "Recent rating in period",
                data.averageRating == null
                    ? "No feedback"
                    : `${data.averageRating}/5`
            ]
        ]
        : [];

    return (
        <section
            className="rx-page"
            aria-busy={loading}
        >
            {/* Page heading */}
            <header className="rx-hero">
                <div>
                    <span className="rx-eyebrow">
                        LUXURYSTAY · HOTEL MANAGEMENT
                    </span>

                    <h1>
                        {overview
                            ? "Management overview"
                            : "Reports & analytics"}
                    </h1>

                    <p>
                        {hotel
                            ? `${hotel.name} · ${hotel.location}`
                            : "Your assigned hotel"}
                    </p>
                </div>

                <button
                    type="button"
                    className="rx-button rx-secondary"
                    disabled={loading}
                    onClick={() => {
                        setApplied(current => ({
                            ...current
                        }));
                    }}
                >
                    Refresh
                </button>
            </header>

            {/* Date filters */}
            <form
                className="rx-toolbar mg-report-filter"
                onSubmit={applyFilters}
            >
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
                    className="rx-button"
                    disabled={loading}
                >
                    Apply dates
                </button>

                <button
                    type="button"
                    className="rx-button rx-secondary"
                    disabled={
                        !data ||
                        loading ||
                        exporting ||
                        Boolean(error)
                    }
                    onClick={download}
                >
                    {exporting
                        ? "Exporting…"
                        : "Export daily CSV"}
                </button>
            </form>

            {error && (
                <p role="alert" className="rx-error">
                    {error}
                </p>
            )}

            {loading && (
                <p role="status">
                    Loading hotel operations and reports…
                </p>
            )}

            {!loading && data && (
                <>
                    <p className="rx-muted">
                        Report: {data.from} to {data.to}
                        {" · "}
                        PKR
                        {" · "}
                        Asia/Karachi
                        {" · "}
                        Current counts refresh on request.
                    </p>

                    {/* Summary cards */}
                    <div className="rx-stats mg-report-stats">
                        {stats.map(([title, value]) => (
                            <article
                                className="rx-stat"
                                key={title}
                            >
                                <span>{title}</span>
                                <strong>{value}</strong>
                            </article>
                        ))}
                    </div>

                    {/* Overview-only information */}
                    {overview && overviewData && (
                        <>
                            <div className="mg-today">
                                <p>
                                    Today:{" "}
                                    <strong>
                                        {overviewData.date}
                                    </strong>
                                </p>

                                <p>
                                    Pending arrivals:{" "}
                                    <strong>
                                        {overviewData.stats.pendingArrivals}
                                    </strong>
                                </p>

                                <p>
                                    Pending departures:{" "}
                                    <strong>
                                        {overviewData.stats.pendingDepartures}
                                    </strong>
                                </p>
                            </div>

                            {overviewData.stats.overdueStays > 0 && (
                                <p className="rx-error">
                                    {overviewData.stats.overdueStays}
                                    {" "}
                                    overdue stay(s). Extend the
                                    reservation and resolve billing
                                    before checkout.
                                </p>
                            )}

                            <div className="rx-shortcuts">
                                <Link to="/manager/housekeeping">
                                    Assign cleaning →
                                </Link>

                                <Link to="/manager/maintenance">
                                    Resolve maintenance →
                                </Link>

                                <Link to="/manager/bookings">
                                    Manage reservations →
                                </Link>

                                <Link to="/manager/invoices">
                                    Review billing →
                                </Link>
                            </div>
                        </>
                    )}

                    {/* Forecast */}
                    <section className="rx-panel">
                        <h2>
                            Demand forecast &amp; pricing review
                        </h2>

                        <ForecastChart
                            forecast={data.forecast}
                        />

                        {data.forecast && (
                            <Link to="/manager/room-types">
                                Review room rates →
                            </Link>
                        )}
                    </section>

                    {/* Occupancy chart */}
                    <section className="rx-panel">
                        <h2>Daily reserved occupancy</h2>

                        <OccupancyChart daily={daily} />

                        <p className="rx-muted">
                            This shows retained reservation nights,
                            not measured physical occupancy.
                        </p>
                    </section>

                    {/* Collections chart */}
                    <section className="rx-panel">
                        <h2>Daily collections</h2>

                        <RevenueChart daily={daily} />
                    </section>

                    {/* Exact daily values */}
                    <section className="rx-panel">
                        <h2>Daily breakdown</h2>

                        <div
                            className="rx-table-wrap"
                            tabIndex={0}
                            role="region"
                            aria-label="Daily report values"
                        >
                            <table className="rx-table mg-report-table">
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
                                            <td>
                                                {day.date}
                                            </td>

                                            <td>
                                                {day.reservedNights}
                                            </td>

                                            <td>
                                                {day.occupancyPercent}%
                                            </td>

                                            <td>
                                                {money(day.collected)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Guest feedback */}
                    <section className="rx-panel">
                        <h2>Guest feedback</h2>

                        {feedback.length > 0 ? (
                            feedback.map(review => (
                                <article
                                    className="mg-review"
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
                                No guest reviews in this period.
                            </p>
                        )}
                    </section>

                    {data.note && (
                        <p className="rx-muted">
                            {data.note}
                        </p>
                    )}
                </>
            )}
        </section>
    );
}