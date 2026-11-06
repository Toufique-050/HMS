import "./charts.css";

function formatMoney(value) {
    return `PKR ${new Intl.NumberFormat("en-PK", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value)}`;
}

export default function RevenueChart({ daily = [] }) {
    const rows = Array.isArray(daily) ? daily : [];

    if (rows.length === 0) {
        return (
            <p>
                No collection data is available for the
                selected period.
            </p>
        );
    }

    const amounts = rows.map(day => {
        const value = Number(day.collected);

        return Number.isFinite(value)
            ? Math.max(0, value)
            : 0;
    });

    const maximum = Math.max(0, ...amounts);

    return (
        <div>
            <div
                className="hotel-chart"
                role="img"
                aria-label={
                    "Daily collections chart. " +
                    "Exact values are shown in the daily breakdown table."
                }
            >
                {rows.map((day, index) => {
                    const value = amounts[index];

                    const height = maximum > 0
                        ? (value / maximum) * 100
                        : 0;

                    return (
                        <div
                            className="hotel-chart__column"
                            key={`${day.date || "day"}-${index}`}
                            title={
                                `${day.date || "Unknown date"}: ` +
                                formatMoney(value)
                            }
                        >
                            <span
                                className="hotel-chart__bar"
                                style={{
                                    height: `${height}%`
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <p className="hotel-chart__note">
                Each bar shows recorded collections for one day.
                Exact amounts appear in the daily breakdown table.
            </p>

            {maximum === 0 && (
                <p className="hotel-chart__note">
                    No payments were recorded in this period.
                </p>
            )}
        </div>
    );
}