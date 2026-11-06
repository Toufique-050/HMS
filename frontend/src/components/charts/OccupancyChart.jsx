export default function OccupancyChart({ daily = [] }) {
    const rows = Array.isArray(daily) ? daily : [];

    if (rows.length === 0) {
        return (
            <p>
                No occupancy data is available for the
                selected period.
            </p>
        );
    }

    return (
        <div>
            <div
                className="hotel-chart"
                role="img"
                aria-label={
                    "Daily reserved occupancy chart. " +
                    "Exact values are shown in the table below."
                }
            >
                {rows.map((day, index) => {
                    const raw = Number(day.occupancyPercent);

                    const value = Number.isFinite(raw)
                        ? Math.max(0, Math.min(100, raw))
                        : 0;

                    return (
                        <div
                            className="hotel-chart__column"
                            key={`${day.date || "day"}-${index}`}
                            title={`${day.date || "Unknown date"}: ${value}%`}
                        >
                            <span
                                className="hotel-chart__bar"
                                style={{
                                    height: `${value}%`
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <p className="hotel-chart__note">
                Each bar represents one day. Exact values are
                shown in the daily breakdown table.
            </p>
        </div>
    );
}