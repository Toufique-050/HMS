import Hotel from "../models/Hotel.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Feedback from "../models/Feedback.js";
import HousekeepingTask from "../models/HousekeepingTask.js";
import Invoice from "../models/Invoice.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Notification from "../models/Notification.js";
import Room from "../models/Room.js";
import RoomNight from "../models/RoomNight.js";
import RoomType from "../models/RoomType.js";
import Service from "../models/Service.js";
import ServiceRequest from "../models/ServiceRequest.js";
import Setting from "../models/Setting.js";

export {
    Hotel,
    User,
    Booking,
    Feedback,
    HousekeepingTask,
    Invoice,
    MaintenanceRequest,
    Notification,
    Room,
    RoomNight,
    RoomType,
    Service,
    ServiceRequest,
    Setting
};

export const resources = {
    hotels: Hotel,
    staff: User,
    guests: User,
    "room-types": RoomType,
    rooms: Room,
    services: Service,
    bookings: Booking,
    invoices: Invoice,
    housekeeping: HousekeepingTask,
    maintenance: MaintenanceRequest,
    "service-requests": ServiceRequest,
    settings: Setting,
    notifications: Notification,
    feedback: Feedback
};