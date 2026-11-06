export const readableResources = Object.freeze([
    "rooms", "room-types", "bookings", "guests", "invoices", "services",
    "service-requests", "housekeeping", "maintenance", "notifications"
]);
export const creatableResources = Object.freeze([
    "bookings", "housekeeping", "maintenance", "service-requests"
]);
export const permittedActions = Object.freeze({
    bookings: ["check-in", "check-out", "extend", "change-room", "cancel", "no-show"],
    invoices: ["payment", "email"],
    "service-requests": ["status"],
    notifications: ["read"]
});
export function mayAct(resource, operation) {
    return permittedActions[resource]?.includes(operation) || false;
}
