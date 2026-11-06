import { AsyncLocalStorage } from "node:async_hooks";

// Each receptionist request keeps its hotel scope across awaits and retries.
// Admin calls do not enter this context and retain existing permissions.
const operationScope = new AsyncLocalStorage();
export const withHotelScope = (hotelId, callback) =>
    operationScope.run(String(hotelId), callback);
export const currentHotelScope = () => operationScope.getStore();

export function scopedFilter(modelName, filter) {
    const hotelId = currentHotelScope();
    if (!hotelId) return filter;
    if (modelName === "Hotel") return { ...filter, _id: hotelId };
    const scoped = new Set([
        "Room", "RoomType", "Booking", "Invoice", "Service",
        "ServiceRequest", "HousekeepingTask", "MaintenanceRequest", "Setting"
    ]);
    return scoped.has(modelName) ? { ...filter, hotelId } : filter;
}
