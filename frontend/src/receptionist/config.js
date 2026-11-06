export const menu = [
    ["dashboard", "Overview"], ["rooms", "Rooms & availability"],
    ["bookings", "Reservations"], ["guests", "Guest details"],
    ["invoices", "Billing & invoices"], ["service-requests", "Guest services"],
    ["housekeeping", "Housekeeping"], ["maintenance", "Maintenance"],
    ["notifications", "Notifications"]
];
export const titles = Object.fromEntries(menu);
export const statuses = {
    bookings: ["confirmed", "checked_in", "checked_out", "cancelled", "no_show"],
    invoices: ["unpaid", "partially_paid", "paid"],
    "service-requests": ["pending", "accepted", "completed", "cancelled"],
    housekeeping: ["pending", "in_progress", "completed"],
    maintenance: ["open", "in_progress", "resolved"]
};
export const money = value => new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 2
}).format(value || 0);
export const date = value => value ? String(value).slice(0, 10) : "—";
export const label = value => String(value || "—").replaceAll("_", " ");
export function localNow() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function hotelToday() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
}
export const columns = {
    rooms: [["Room", r => r.roomNumber], ["Type", r => r.roomTypeId?.name], ["Capacity", r => r.roomTypeId?.capacity], ["Nightly rate", r => money(r.roomTypeId?.baseRate)], ["Occupancy", r => r.occupancyStatus], ["Cleaning", r => r.housekeepingStatus], ["Maintenance", r => r.maintenanceStatus], ["Active", r => r.isActive ? "Yes" : "No"]],
    bookings: [["Reference", r => r.reference], ["Guest", r => r.guestSnapshot?.name], ["Room", r => r.roomId?.roomNumber], ["Arrival", r => date(r.checkIn)], ["Departure", r => date(r.checkOut)], ["Guests", r => r.guests], ["Status", r => label(r.status)]],
    guests: [["Booking", r => r.reference], ["Guest", r => r.guestSnapshot?.name], ["Phone", r => r.guestSnapshot?.phone], ["Email", r => r.guestSnapshot?.email], ["Room", r => r.roomId?.roomNumber], ["Status", r => label(r.status)]],
    invoices: [["Invoice", r => r.number], ["Booking", r => r.bookingId?.reference], ["Guest", r => r.bookingId?.guestSnapshot?.name], ["Total", r => money(r.grandTotal)], ["Paid", r => money(r.paid)], ["Balance", r => money(r.balance)], ["Status", r => label(r.status)]],
    "service-requests": [["Booking", r => r.bookingId?.reference], ["Service", r => r.serviceId?.name], ["Quantity", r => r.quantity], ["Unit price", r => money(r.priceSnapshot)], ["Scheduled", r => r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : "—"], ["Notes", r => r.notes], ["Status", r => label(r.status)]],
    housekeeping: [["Room", r => r.roomId?.roomNumber], ["Assigned to", r => r.assignedTo?.name || "Awaiting assignment"], ["Scheduled", r => r.scheduledAt ? new Date(r.scheduledAt).toLocaleString() : "—"], ["Notes", r => r.notes], ["Status", r => label(r.status)]],
    maintenance: [["Room", r => r.roomId?.roomNumber], ["Issue", r => r.issue], ["Priority", r => r.priority], ["Assigned to", r => r.assignedTo?.name || "Awaiting assignment"], ["Resolution", r => r.resolution], ["Status", r => label(r.status)]],
    notifications: [["Message", r => r.message], ["Received", r => new Date(r.createdAt).toLocaleString()], ["Status", r => r.isRead ? "Read" : "Unread"]]
};
