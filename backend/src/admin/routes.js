import { Router } from "express";
import { z } from "zod";
import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import { resources, Booking, RoomNight } from "./models.js";
import { parse, assert, id } from "./rules.js";
import { create, update, action } from "./service.js";
import { report, csv } from "./reports.js";
const router = Router();
router.use(verifyToken, allowRoles("Admin"));
// Await index initialization before any admin writes. Unique indexes are essential.
let initialized;
router.use(async (req, res, next) => {
    if (!initialized) initialized = Promise.all([...new Set([...Object.values(resources), RoomNight])].map(Model => Model.init())).catch(error => { initialized = null; throw error; });
    await initialized;
    next();
});
const searchFields = {
    hotels: ["name", "location"], staff: ["name", "email"], guests: ["name", "email", "phone"],
    "room-types": ["name"], rooms: ["roomNumber"], bookings: ["reference", "guestSnapshot.name", "guestSnapshot.phone"],
    invoices: ["number"], services: ["name", "category"], housekeeping: ["notes"], maintenance: ["issue"],
    "service-requests": ["notes"], notifications: ["message"], settings: ["invoicePrefix"], feedback: ["comment"]
};
const populate = {
    "room-types": [["hotelId", "name"]], rooms: [["hotelId", "name"], ["roomTypeId", "name"]],
    staff: [["hotelId", "name"]],
    bookings: [["hotelId", "name"], ["roomId", "roomNumber"]],
    invoices: [["hotelId", "name"], ["bookingId", "reference guestSnapshot checkIn checkOut status"]],
    services: [["hotelId", "name"]], housekeeping: [["hotelId", "name"], ["roomId", "roomNumber"], ["assignedTo", "name"]],
    maintenance: [["hotelId", "name"], ["roomId", "roomNumber"], ["assignedTo", "name"]],
    "service-requests": [["bookingId", "reference"], ["serviceId", "name"]],
    settings: [["hotelId", "name"]], feedback: [["bookingId", "reference"], ["guestId", "name"]]
};
router.get("/reports", async (req, res) => res.json(await report(req.query)));
router.get("/reports.csv", async (req, res) => {
    const data = await report(req.query);
    res.type("text/csv").attachment("luxurystay-report.csv").send(csv(data.daily));
});
router.get("/:resource", async (req, res) => {
    const resource = req.params.resource, Model = resources[resource];
    assert(Model, "Resource not found", 404);
    const page = parse(z.coerce.number().int().min(1).max(10000), req.query.page || 1);
    const limit = parse(z.coerce.number().int().min(1).max(500), req.query.limit || 20);
    const filter = {};
    if (resource === "staff") filter.role = { $ne: "Guest" };
    if (resource === "guests") filter.role = "Guest";
    if (resource === "notifications") filter.recipientId = req.user._id;
    if (req.query.hotelId && resource !== "hotels" && resource !== "notifications") {
        const hotelId = parse(id, req.query.hotelId);
        if (resource === "feedback") filter.bookingId = { $in: (await Booking.find({ hotelId }).select("_id")).map(v => v._id) };
        else if (resource !== "guests") filter.hotelId = hotelId;
    }
    if (req.query.q) {
        const q = parse(z.string().max(100), req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = (searchFields[resource] || []).map(field => ({ [field]: { $regex: q, $options: "i" } }));
    }
    if (req.query.status) {
        const status = parse(z.string().max(30), req.query.status);
        if (["bookings", "invoices", "housekeeping", "maintenance", "service-requests"].includes(resource)) filter.status = status;
    }
    let request = Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    for (const [path, select] of populate[resource] || []) request = request.populate(path, select);
    const [items, total] = await Promise.all([request.lean(), Model.countDocuments(filter)]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
router.post("/:resource", async (req, res) => res.status(201).json({ item: await create(req.params.resource, req.body, req.user) }));
router.put("/:resource/:id", async (req, res) => res.json({ item: await update(req.params.resource, req.params.id, req.body, req.user) }));
router.post("/:resource/:id/:action", async (req, res) => res.json({ item: await action(req.params.resource, req.params.id, req.params.action, req.body, req.user) }));
router.use((error, req, res, next) => {
    if (error.code === 11000) return res.status(409).json({ message: "Record conflicts with an existing booking, email, room number or hotel setting. Refresh and retry." });
    if (/Transaction numbers|replica set|mongos/i.test(error.message || "")) return res.status(503).json({ message: "This workflow needs MongoDB Atlas or a replica set; standalone MongoDB does not support transactions." });
    next(error);
});
export default router;