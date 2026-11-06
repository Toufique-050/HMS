import { Router } from "express";
import { z } from "zod";
import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import * as M from "../admin/models.js";
import { create, update, action } from "../admin/service.js";
import { parse, assert, id, dateOnly, nights, today } from "../admin/rules.js";
import { withHotelScope } from "../utils/operationScope.js";
import { readableResources, creatableResources, managedResources, enforceHotelInput, mayAct } from "./policy.js";

import { managerReport } from "./reports.js";
import { csv } from "../admin/reports.js";

const router = Router();
router.use(verifyToken, allowRoles("Manager"));
let initialized;
router.use(async (req, res, next) => {
    assert(req.user.hotelId, "Your account has no assigned hotel", 403);
    const hotel = await M.Hotel.findOne({ _id: req.user.hotelId, isActive: true })
        .select("name location address contact").lean();
    assert(hotel, "Your assigned hotel is unavailable", 403);
    req.frontDeskHotel = hotel;
    if (!initialized) initialized = Promise.all(
        [...new Set([...Object.values(M.resources), M.RoomNight])].map(Model => Model.init())
    ).catch(error => { initialized = null; throw error; });
    await initialized;
    next();
});
const hotelId = req => req.frontDeskHotel._id;
const scope = (req, callback) => withHotelScope(hotelId(req), callback);
const ModelFor = resource => resource === "guests" ? M.Booking : M.resources[resource];
const queryText = z.string().trim().max(100);
const pageNumber = z.coerce.number().int().min(1).max(10000);
const pageSize = z.coerce.number().int().min(1).max(50);
const search = {
    rooms: ["roomNumber", "floor"], "room-types": ["name"],
    bookings: ["reference", "guestSnapshot.name", "guestSnapshot.phone"],
    guests: ["reference", "guestSnapshot.name", "guestSnapshot.phone", "guestSnapshot.email"],
    invoices: ["number"], services: ["name", "category"],
    housekeeping: ["notes"], maintenance: ["issue"],
    "service-requests": ["notes"], notifications: ["message"]
};
const populate = {
    rooms: [["roomTypeId", "name capacity baseRate isActive"]],
    bookings: [["roomId", "roomNumber"], ["roomTypeId", "name"]],
    guests: [["roomId", "roomNumber"]],
    invoices: [["bookingId", "reference guestSnapshot checkIn checkOut status roomId rateSnapshot" ]],
    housekeeping: [["roomId", "roomNumber"], ["assignedTo", "name"]],
    maintenance: [["roomId", "roomNumber"], ["assignedTo", "name"]],
    "service-requests": [["bookingId", "reference guestSnapshot"], ["serviceId", "name category"]]
};
function resourceFilter(req, resource) {
    return resource === "notifications"
        ? { recipientId: req.user._id }
        : { hotelId: hotelId(req) };
}
async function owned(req, resource, key) {
    parse(id, key);
    const Model = ModelFor(resource);
    assert(Model, "Resource not found", 404);
    const item = await Model.findOne({ _id: key, ...resourceFilter(req, resource) });
    assert(item, "Record not found in your hotel", 404);
    return item;
}
async function alertManagers(req, message, reference) {
    const managers = await M.User.find({ hotelId: hotelId(req), role: "Manager", isActive: true }).select("_id");
    if (managers.length) await M.Notification.insertMany(managers.map(manager => ({
        recipientId: manager._id, type: "front_desk", message, reference: String(reference)
    })));
}
router.get("/dashboard", async (req, res) => {
    const hotel = hotelId(req), date = today();
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(start.getTime() + 86400000);
    const arrivals = { hotelId: hotel, status: "confirmed", checkIn: { $gte: start, $lt: end } };
    const departures = { hotelId: hotel, status: "checked_in", checkOut: { $gte: start, $lt: end } };
    const [totalRooms, occupiedRooms, readyRooms, pendingArrivals, pendingDepartures,
        balances, arrivalItems, departureItems, overdueStays] = await Promise.all([
        M.Room.countDocuments({ hotelId: hotel, isActive: true }),
        M.Room.countDocuments({ hotelId: hotel, isActive: true, occupancyStatus: "occupied" }),
        M.Room.countDocuments({ hotelId: hotel, isActive: true, occupancyStatus: "vacant", housekeepingStatus: "clean", maintenanceStatus: "operational" }),
        M.Booking.countDocuments(arrivals), M.Booking.countDocuments(departures),
        M.Invoice.aggregate([{ $match: { hotelId: hotel, balance: { $gt: 0 } } }, { $group: { _id: null, amount: { $sum: "$balance" } } }]),
        M.Booking.find(arrivals).populate("roomId", "roomNumber").sort({ checkIn: 1, _id: 1 }).limit(10).lean(),
        M.Booking.find(departures).populate("roomId", "roomNumber").sort({ checkOut: 1, _id: 1 }).limit(10).lean(),
        M.Booking.countDocuments({ hotelId: hotel, status: "checked_in", checkOut: { $lt: start } })
    ]);
    res.json({ hotel: req.frontDeskHotel, date,
        stats: { totalRooms, occupiedRooms, readyRooms, pendingArrivals, pendingDepartures,
            outstandingBalance: balances[0]?.amount || 0, overdueStays },
        arrivals: arrivalItems, departures: departureItems });
});

router.get("/availability", async (req, res) => {
    const checkIn = parse(dateOnly, req.query.checkIn);
    const checkOut = parse(dateOnly, req.query.checkOut);
    const guests = parse(z.coerce.number().int().min(1).max(20), req.query.guests);
    const dates = nights(checkIn, checkOut);
    assert(checkIn >= today(), "Check-in cannot be in the past");
    const types = await M.RoomType.find({ hotelId: hotelId(req), isActive: true, capacity: { $gte: guests } }).lean();
    const typeMap = new Map(types.map(type => [String(type._id), type]));
    const filter = { hotelId: hotelId(req), isActive: true, maintenanceStatus: "operational", roomTypeId: { $in: types.map(type => type._id) } };
    // For same-day walk-ins show rooms that can actually be checked in now.
    if (checkIn === today()) Object.assign(filter, { occupancyStatus: "vacant", housekeepingStatus: "clean" });
    const rooms = await M.Room.find(filter).sort({ roomNumber: 1 }).lean();
    const roomIds = rooms.map(room => room._id);
    const [locks, reservations, openCleaning, openMaintenance, overdue] = await Promise.all([
        M.RoomNight.find({ roomId: { $in: roomIds }, date: { $gte: new Date(checkIn), $lt: new Date(checkOut) } }).select("roomId").lean(),
        M.Booking.find({ hotelId: hotelId(req), roomId: { $in: roomIds }, status: { $in: ["confirmed", "checked_in"] }, checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }).select("roomId").lean(),
        checkIn === today() ? M.HousekeepingTask.find({ hotelId: hotelId(req), status: { $ne: "completed" } }).select("roomId").lean() : [],
        M.MaintenanceRequest.find({ hotelId: hotelId(req), status: { $ne: "resolved" } }).select("roomId").lean(),
        M.Booking.find({ hotelId: hotelId(req), status: "checked_in", checkOut: { $lte: new Date(today()) } }).select("roomId").lean()
    ]);
    const blocked = new Set([...locks, ...reservations, ...openCleaning, ...openMaintenance, ...overdue].map(item => String(item.roomId)));
    const settings = await M.Setting.findOne({ hotelId: hotelId(req) }).lean();
    const taxRate = settings?.taxRate || 0;
    res.json({ nights: dates.length, taxRate, items: rooms.filter(room => !blocked.has(String(room._id))).map(room => {
        const type = typeMap.get(String(room.roomTypeId));
        const roomTotal = Math.round(dates.length * type.baseRate * 100) / 100;
        const tax = Math.round(roomTotal * taxRate) / 100;
        return { ...room, roomTypeId: type, nights: dates.length, roomTotal, tax, estimatedTotal: Math.round((roomTotal + tax) * 100) / 100 };
    }) });
});

router.get("/options", async (req, res) => {
    const [rooms, services, bookings, staff, roomTypes] = await Promise.all([
        M.Room.find({ hotelId: hotelId(req), isActive: true }).populate("roomTypeId", "name capacity").sort({ roomNumber: 1 }).limit(1000).lean(),
        M.Service.find({ hotelId: hotelId(req), isActive: true }).sort({ name: 1 }).limit(500).lean(),
        M.Booking.find({ hotelId: hotelId(req), status: "checked_in" }).select("reference guestSnapshot roomId").sort({ reference: 1 }).limit(1000).lean(),
        M.User.find({ hotelId: hotelId(req), role: { $in: ["Manager", "Receptionist", "Housekeeping"] }, isActive: true }).select("name role hotelId").sort({ name: 1 }).limit(1000).lean(),
        M.RoomType.find({ hotelId: hotelId(req), isActive: true }).select("name capacity baseRate").sort({ name: 1 }).limit(1000).lean()
    ]);
    res.json({ hotel: req.frontDeskHotel, rooms, services, bookings, staff, roomTypes });
});
router.get("/invoices/:id/print", async (req, res) => {
    const invoice = await owned(req, "invoices", req.params.id);
    const booking = await M.Booking.findOne({ _id: invoice.bookingId, hotelId: hotelId(req) }).populate("roomId", "roomNumber").lean();
    assert(booking, "Booking not found", 404);
    res.json({ invoice, booking, hotel: req.frontDeskHotel });
});
router.get("/hotel", async (req, res) => {
    const hotel = await M.Hotel.findOne({ _id: hotelId(req), isActive: true }).lean();
    assert(hotel, "Hotel not found", 404); res.json({ item: hotel });
});
router.put("/hotel", async (req, res) => {
    const hotel = await M.Hotel.findOne({ _id: hotelId(req), isActive: true }).lean();
    assert(hotel, "Hotel not found", 404);
    assert(req.body && typeof req.body === "object" && !Array.isArray(req.body), "Send a JSON object");
    assert(!("hotelId" in req.body) && !("isActive" in req.body), "Hotel access and active status are controlled by Admin", 403);
    const item = await scope(req, () => update("hotels", String(hotelId(req)), { ...req.body, isActive: hotel.isActive }, req.user));
    res.json({ item });
});
router.get("/reports", async (req, res) => {
    // Never accept a client-selected hotel. Only dates may be supplied.
    res.json(await managerReport(hotelId(req), req.query));
});
router.get("/reports.csv", async (req, res) => {
    const data = await managerReport(hotelId(req), req.query);
    res.type("text/csv").attachment("LuxuryStay_Hotel_Daily_Report.csv").send(csv(data.daily));
});
router.get("/manage/:resource", async (req, res) => {
    const resource = req.params.resource;
    assert(managedResources.includes(resource), "Management resource not found", 404);
    const page = parse(pageNumber, req.query.page || 1), limit = parse(pageSize, req.query.limit || 20);
    const filter = { hotelId: hotelId(req) };
    if (req.query.q) {
        const q = parse(queryText, req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = search[resource].map(field => ({ [field]: { $regex: q, $options: "i" } }));
    }
    if (req.query.active) filter.isActive = parse(z.enum(["true", "false"]), req.query.active) === "true";
    const Model = M.resources[resource];
    let request = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
    if (resource === "rooms") request = request.populate("roomTypeId", "name capacity baseRate");
    const [items, total] = await Promise.all([request.lean(), Model.countDocuments(filter)]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.post("/manage/:resource", async (req, res) => {
    const resource = req.params.resource;
    assert(managedResources.includes(resource), "Creation is not permitted", 403);
    const item = await scope(req, () => create(resource, enforceHotelInput(req.body, hotelId(req)), req.user));
    res.status(201).json({ item });
});
router.put("/manage/:resource/:id", async (req, res) => {
    const resource = req.params.resource;
    assert(managedResources.includes(resource), "Update is not permitted", 403);
    await owned(req, resource, req.params.id);
    const item = await scope(req, () => update(resource, req.params.id, enforceHotelInput(req.body, hotelId(req)), req.user));
    res.json({ item });
});

router.get("/:resource", async (req, res) => {
    const resource = req.params.resource;
    assert(readableResources.includes(resource), "Resource not found", 404);
    const page = parse(pageNumber, req.query.page || 1), limit = parse(pageSize, req.query.limit || 20);
    const filter = resourceFilter(req, resource);
    if (req.query.q) {
        const q = parse(queryText, req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = search[resource].map(field => ({ [field]: { $regex: q, $options: "i" } }));
    }
    if (req.query.status && ["bookings", "invoices", "housekeeping", "maintenance", "service-requests"].includes(resource)) filter.status = parse(z.string().max(30), req.query.status);
    if (resource === "notifications" && req.query.unread === "true") filter.isRead = false;
    const Model = ModelFor(resource);
    let request = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
    for (const [path, select] of populate[resource] || []) request = request.populate(path, select);
    const [items, total] = await Promise.all([request.lean(), Model.countDocuments(filter)]);
    res.json({ items, page, total, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.post("/:resource", async (req, res) => {
    const resource = req.params.resource;
    assert(creatableResources.includes(resource), "Creation is not permitted", 403);
    // Strict shared validation will reject unexpected account/assignment fields.
    if (resource === "bookings") assert(!req.body.guestId, "Use guest details; linking guest accounts is not available here");
    // The shared service validates any assignee role, activity and hotel inside its transaction.
    const item = await scope(req, () => create(resource, req.body, req.user));
    // The business operation is committed. Notification failure must not imply it failed.
    if (["housekeeping", "maintenance"].includes(resource)) {
        try { await alertManagers(req, `${resource} request from front desk`, item._id); }
        catch { console.error("Front desk manager notification failed"); }
    }
    res.status(201).json({ item });
});
router.put("/guests/:id", async (req, res) => {
    parse(id, req.params.id);
    const guest = parse(z.object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(1).max(30),
        email: z.union([z.email(), z.literal("")]).default("")
    }).strict(), req.body);
    // Guest records here are reservation snapshots, not global login accounts.
    const booking = await M.Booking.findOneAndUpdate({ _id: req.params.id, hotelId: hotelId(req), status: { $in: ["confirmed", "checked_in"] } },
        { $set: { guestSnapshot: guest } }, { new: true, runValidators: true });
    assert(booking, "Only active reservations in your hotel can be edited", 404);
    res.json({ item: booking });
});
router.post("/:resource/:id/:action", async (req, res) => {
    const { resource, id: key, action: operation } = req.params;
    assert(mayAct(resource, operation), "This action is not permitted", 403);
    await owned(req, resource, key);
    const item = await scope(req, () => action(resource, key, operation, req.body, req.user));
    if (["housekeeping", "maintenance"].includes(resource) && operation === "status") {
        try {
            const recipients = await M.User.find({ hotelId: hotelId(req), isActive: true, role: "Receptionist" }).select("_id");
            if (recipients.length) await M.Notification.insertMany(recipients.map(user => ({ recipientId: user._id, type: "operations", message: `${resource} updated: ${item.status}`, reference: String(item._id) })));
        } catch { console.error("Manager operation notification failed"); }
    }
    res.json({ item });
});
router.use((error, req, res, next) => {
    if (error.code === 11000) return res.status(409).json({ message: "Room/date or record conflict. Refresh availability before trying again." });
    if (/Transaction numbers|replica set|mongos/i.test(error.message || "")) return res.status(503).json({ message: "Booking, payment and check-in/out require MongoDB Atlas or a replica set." });
    next(error);
});
export default router;
