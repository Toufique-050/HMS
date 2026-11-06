import { Router } from "express";
import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import HousekeepingTask from "../models/HousekeepingTask.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Notification from "../models/Notification.js";
import { parse, assert, today } from "../admin/rules.js";
import { recordId, pageQuery, cleaningUpdate, reportIssue, issueUpdate } from "./validators.js";
import { updateCleaning, createIssue, updateAssignedIssue } from "./service.js";

const router = Router();
router.use(verifyToken, allowRoles("Housekeeping"));
let initialized;
router.use(async (req, res, next) => {
    assert(req.user.hotelId, "Your account has no assigned hotel", 403);
    const hotel = await Hotel.findOne({ _id: req.user.hotelId, isActive: true }).select("name location").lean();
    assert(hotel, "Your assigned hotel is unavailable", 403);
    req.housekeepingHotel = hotel;
    if (!initialized) initialized = Promise.all([HousekeepingTask.init(), MaintenanceRequest.init(), Notification.init()]).catch(error => { initialized = null; throw error; });
    await initialized; next();
});
const taskScope = req => ({ hotelId: req.user.hotelId, assignedTo: req.user._id });
const issueScope = (req, view = "all") => ({ hotelId: req.user.hotelId,
    ...(view === "assigned" ? { assignedTo: req.user._id } : view === "reported" ? { reportedBy: req.user._id } : { $or: [{ reportedBy: req.user._id }, { assignedTo: req.user._id }] }) });
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function page(Model, filter, query, populates = []) {
    let request = Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit);
    for (const [path, select] of populates) request = request.populate(path, select);
    const [items, total] = await Promise.all([request.lean(), Model.countDocuments(filter)]);
    return { items, total, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) };
}
const roomFields = "roomNumber floor occupancyStatus housekeepingStatus maintenanceStatus isActive";
router.get("/dashboard", async (req, res) => {
    const date = today(), start = new Date(`${date}T00:00:00+05:00`), end = new Date(+start + 86400000);
    const scope = taskScope(req);
    const [pending, inProgress, completedToday, overdue, assignedMaintenance, reportedOpen, unread, upcoming] = await Promise.all([
        HousekeepingTask.countDocuments({ ...scope, status: "pending" }),
        HousekeepingTask.countDocuments({ ...scope, status: "in_progress" }),
        HousekeepingTask.countDocuments({ ...scope, status: "completed", completedAt: { $gte: start, $lt: end } }),
        HousekeepingTask.countDocuments({ ...scope, status: { $in: ["pending", "in_progress"] }, scheduledAt: { $lt: start } }),
        MaintenanceRequest.countDocuments({ hotelId: req.user.hotelId, assignedTo: req.user._id, status: { $ne: "resolved" } }),
        MaintenanceRequest.countDocuments({ hotelId: req.user.hotelId, reportedBy: req.user._id, status: { $ne: "resolved" } }),
        Notification.countDocuments({ recipientId: req.user._id, isRead: false }),
        HousekeepingTask.find({ ...scope, status: { $in: ["pending", "in_progress"] } }).select("roomId scheduledAt notes status startedAt").populate("roomId", roomFields).sort({ scheduledAt: 1, _id: 1 }).limit(6).lean()
    ]);
    res.json({ hotel: req.housekeepingHotel, date, stats: { pending, inProgress, completedToday, overdue, assignedMaintenance, reportedOpen, unread }, upcoming });
});
router.get("/tasks", async (req, res) => {
    const query = parse(pageQuery, req.query), filter = taskScope(req);
    if (query.status) { assert(["pending", "in_progress", "completed"].includes(query.status), "Invalid cleaning status"); filter.status = query.status; }
    if (query.q) filter.notes = { $regex: escape(query.q), $options: "i" };
    res.json(await page(HousekeepingTask, filter, query, [["roomId", roomFields]]));
});
router.post("/tasks/:id/status", async (req, res) => {
    const key = parse(recordId, req.params.id), body = parse(cleaningUpdate, req.body);
    res.json({ item: await updateCleaning(req.user, key, body) });
});
router.get("/options", async (req, res) => {
    // Only room labels needed to report an issue; no guest, rate or booking data.
    const rooms = await Room.find({ hotelId: req.user.hotelId, isActive: true }).select("roomNumber floor").sort({ roomNumber: 1 }).limit(1000).lean();
    res.json({ hotel: req.housekeepingHotel, rooms });
});
router.get("/maintenance", async (req, res) => {
    const query = parse(pageQuery, req.query), filter = issueScope(req, query.view);
    if (query.status) { assert(["open", "in_progress", "resolved"].includes(query.status), "Invalid maintenance status"); filter.status = query.status; }
    if (query.q) filter.issue = { $regex: escape(query.q), $options: "i" };
    res.json(await page(MaintenanceRequest, filter, query, [["roomId", "roomNumber floor"], ["assignedTo", "name role"]]));
});
router.post("/maintenance", async (req, res) => res.status(201).json({ item: await createIssue(req.user, parse(reportIssue, req.body)) }));
router.post("/maintenance/:id/work", async (req, res) => res.json({ item: await updateAssignedIssue(req.user, parse(recordId, req.params.id), parse(issueUpdate, req.body)) }));
router.get("/notifications", async (req, res) => {
    const query = parse(pageQuery, req.query), filter = { recipientId: req.user._id };
    if (query.unread === "true") filter.isRead = false;
    if (query.q) filter.message = { $regex: escape(query.q), $options: "i" };
    res.json(await page(Notification, filter, query));
});
router.post("/notifications/:id/read", async (req, res) => {
    const key = parse(recordId, req.params.id);
    const item = await Notification.findOneAndUpdate({ _id: key, recipientId: req.user._id }, { $set: { isRead: true } }, { new: true }).select("_id isRead").lean();
    assert(item, "Notification not found", 404); res.json({ item });
});
router.use((req, res) => res.status(404).json({ message: "Housekeeping endpoint not found" }));
router.use((error, req, res, next) => {
    if (/Transaction numbers|replica set|mongos/i.test(error.message || "")) return res.status(503).json({ message: "Housekeeping updates require MongoDB Atlas or a replica set." });
    next(error);
});
export default router;
