// A manager operates only inside the hotel assigned to their active account.
export const readableResources = Object.freeze([
    "rooms", "room-types", "bookings", "guests", "invoices", "services",
    "service-requests", "housekeeping", "maintenance", "notifications"
]);
export const creatableResources = Object.freeze([
    "bookings", "housekeeping", "maintenance", "service-requests"
]);
export const managedResources = Object.freeze(["room-types", "rooms", "services"]);
export const permittedActions = Object.freeze({
    bookings: ["check-in", "check-out", "extend", "change-room", "cancel", "no-show"],
    invoices: ["payment", "email", "discount"],
    rooms: ["readiness"],
    housekeeping: ["assign", "status"],
    maintenance: ["assign", "status"],
    "service-requests": ["status"],
    notifications: ["read"]
});
export function mayAct(resource, operation) {
    return permittedActions[resource]?.includes(operation) || false;
}
export function enforceHotelInput(input, hotelId) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        const error = new Error("Send a JSON object"); error.status = 400; throw error;
    }
    if (input.hotelId !== undefined && String(input.hotelId) !== String(hotelId)) {
        const error = new Error("You can manage only your assigned hotel"); error.status = 403; throw error;
    }
    return { ...input, hotelId: String(hotelId) };
}
