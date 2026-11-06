export const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const dayText = value => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date(value));
export function makeForecast(nightRows, rooms) {
    const observedDays = new Set(nightRows.map(row => String(row.date).slice(0, 10))).size;
    if (!rooms || observedDays < 7) return null;
    const raw = nightRows.length / (28 * rooms);
    return {
        method: "Previous 28 calendar days: retained reserved room nights / (28 × current active room inventory)",
        occupancyPercent: round(100 * raw),
        next7RoomNights: round(nightRows.length / 28 * 7),
        suggestion: raw >= 0.8 ? "Consider a rate review for new bookings. Manager approval and manual rate update are required." : "Review promotions and guest service quality before changing rates. No automatic price change is made."
    };
}
export function calculateDaily(dayLabels, nightRows, invoices, roomCount) {
    const counts = new Map(), collections = new Map();
    for (const row of nightRows) {
        const date = String(row.date).slice(0, 10);
        counts.set(date, (counts.get(date) || 0) + 1);
    }
    for (const invoice of invoices) for (const payment of invoice.payments || []) {
        if (!payment.paidAt) continue;
        const date = dayText(payment.paidAt);
        collections.set(date, (collections.get(date) || 0) + payment.amount);
    }
    return dayLabels.map(date => ({ date, reservedNights: counts.get(date) || 0,
        occupancyPercent: roomCount ? round(100 * (counts.get(date) || 0) / roomCount) : 0,
        collected: round(collections.get(date) || 0) }));
}
