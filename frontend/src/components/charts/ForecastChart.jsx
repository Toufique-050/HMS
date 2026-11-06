import "./charts.css";

export default function ForecastChart({ forecast }) {
    if (!forecast) {
        return (
            <p>
                Insufficient history for a forecast. At least
                seven distinct days with reserved room nights
                in the previous 28 days and active rooms are
                required.
            </p>
        );
    }

    const rawPercent = Number(forecast.occupancyPercent);
    const rawNights = Number(forecast.next7RoomNights);

    const hasPercent = Number.isFinite(rawPercent);
    const hasNights = Number.isFinite(rawNights);

    const barPercent = hasPercent
        ? Math.max(0, Math.min(100, rawPercent))
        : 0;

    return (
        <div className="hotel-forecast">
            <div className="hotel-forecast__summary">
                <div>
                    <span>Estimated reserved occupancy</span>

                    <strong>
                        {hasPercent
                            ? `${rawPercent}%`
                            : "Unavailable"}
                    </strong>
                </div>

                <div>
                    <span>Estimated room nights · next 7 days</span>

                    <strong>
                        {hasNights
                            ? rawNights.toLocaleString("en-PK", {
                                maximumFractionDigits: 2
                            })
                            : "Unavailable"}
                    </strong>
                </div>
            </div>

            {hasPercent && (
                <div
                    className="hotel-forecast__track"
                    role="progressbar"
                    aria-label="Estimated reserved occupancy"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={barPercent}
                    aria-valuetext={`${rawPercent}% estimated reserved occupancy`}
                >
                    <span
                        className="hotel-forecast__fill"
                        style={{
                            width: `${barPercent}%`
                        }}
                    />
                </div>
            )}

            {forecast.suggestion && (
                <p className="hotel-forecast__suggestion">
                    {forecast.suggestion}
                </p>
            )}

            {forecast.method && (
                <p className="hotel-chart__note">
                    {forecast.method}
                </p>
            )}

            <p className="hotel-chart__note">
                This is an estimate based on historical
                reservations. It does not automatically
                change room prices.
            </p>
        </div>
    );
}