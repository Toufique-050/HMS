import mongoose from "mongoose";
import Hotel from "../models/Hotel.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import HousekeepingTask from "../models/HousekeepingTask.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Notification from "../models/Notification.js";
import { assert } from "../admin/rules.js";
import { requireTransition, requireChecklist, nextCleaningState } from "./policy.js";
import {
    publishHotelUpdate
} from "../realtime/socketServer.js";

async function transaction(callback) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => callback(session)); }
    finally { await session.endSession(); }
}
async function actorActive(actor, session) {
    const current = await User.findOne({ _id: actor._id, hotelId: actor.hotelId, role: "Housekeeping", isActive: true }).select("_id").session(session);
    assert(current, "Your access changed. Please log in again.", 403);
    assert(await Hotel.exists({ _id: actor.hotelId, isActive: true }).session(session), "Your assigned hotel is unavailable", 403);
}
async function lockRoom(roomId, actor, session) {
    // Same room lock as existing booking/admin/manager workflows.
    const room = await Room.findOneAndUpdate({ _id: roomId, hotelId: actor.hotelId },
        { $inc: { bookingVersion: 1 } }, { new: true, session });
    assert(room, "Room not found in your hotel", 404);
    return room;
}
async function notify(actor, message, reference, session, frontDesk = false) {
    const supervisors = await User.find({ hotelId: actor.hotelId, role: "Manager", isActive: true }).select("_id").session(session);
    const fallbackAdmins = supervisors.length ? [] : await User.find({ role: "Admin", isActive: true }).select("_id").session(session);
    const receptionists = frontDesk ? await User.find({ hotelId: actor.hotelId, role: "Receptionist", isActive: true }).select("_id").session(session) : [];
    const recipients = new Set([String(actor._id), ...[...supervisors, ...fallbackAdmins, ...receptionists].map(user => String(user._id))]);
    await Notification.insertMany([...recipients].map(recipientId => ({ recipientId, type: "housekeeping", message, reference: String(reference) })), { session });
}
async function performUpdateCleaning(actor, key, data)  {
    return transaction(async session => {
        await actorActive(actor, session);
        let task = await HousekeepingTask.findOne({ _id: key, hotelId: actor.hotelId, assignedTo: actor._id }).session(session);
        assert(task, "Task is no longer assigned to you. Refresh your tasks.", 404);
        const room = await lockRoom(task.roomId, actor, session);
        // Recheck ownership within the same transaction that updates the room.
        task = await HousekeepingTask.findOne({ _id: key, hotelId: actor.hotelId, assignedTo: actor._id }).session(session);
        assert(task, "Task is no longer assigned to you", 404);
        requireTransition(task.status, data.status);
        assert(room.occupancyStatus === "vacant", "Guest must check out before this cleaning task can start or finish.", 409);
        if (data.status === "in_progress") {
            task.status = "in_progress"; task.startedAt = new Date();
            room.housekeepingStatus = "cleaning";
        } else {
            requireChecklist(data.checklist);
            task.status = "completed"; task.completedAt = new Date(); task.completedBy = actor._id;
            task.checklist = data.checklist; task.completionNotes = data.completionNotes;
            const others = await HousekeepingTask.find({ roomId: room._id, hotelId: actor.hotelId, _id: { $ne: task._id }, status: { $ne: "completed" } }).select("status").session(session).lean();
            room.housekeepingStatus = nextCleaningState(others);
        }
        await task.save({ session }); await room.save({ session });
        await notify(actor, `Room ${room.roomNumber}: cleaning ${task.status}. Cleaning status: ${room.housekeepingStatus}.`, task._id, session, data.status === "completed");
        return { _id: task._id, status: task.status, housekeepingStatus: room.housekeepingStatus };
    });
}
async function performCreateIssue(actor, data)  {
    return transaction(async session => {
        await actorActive(actor, session);
        const room = await lockRoom(data.roomId, actor, session);
        assert(room.isActive, "Choose an active room");
        const [issue] = await MaintenanceRequest.create([{ hotelId: actor.hotelId, roomId: room._id, reportedBy: actor._id, issue: data.issue, priority: data.priority }], { session });
        await notify(actor, `Room ${room.roomNumber}: ${data.priority} maintenance issue reported by housekeeping.`, issue._id, session);
        // Do not vacate an occupied room or cancel existing reservations automatically.
        // Existing check-in workflow checks unresolved maintenance separately.
        return { _id: issue._id, status: issue.status };
    });
}
async function performUpdateAssignedIssue(actor, key, data)  {
    return transaction(async session => {
        await actorActive(actor, session);
        const issue = await MaintenanceRequest.findOne({ _id: key, hotelId: actor.hotelId, assignedTo: actor._id }).session(session);
        assert(issue, "This maintenance work is not assigned to you", 404);
        const room = await lockRoom(issue.roomId, actor, session);
        assert(issue.status !== "resolved", "Resolved work is locked. Refresh the page.", 409);
        if (data.action === "start") {
            assert(issue.status === "open", "This issue is already in progress. Refresh the page.", 409);
            issue.status = "in_progress";
        } else {
            assert(issue.status === "in_progress", "Start assigned work before submitting an update", 409);
            issue.workNotes = data.workNotes; issue.workUpdatedAt = new Date();
        }
        await issue.save({ session });
        await notify(actor, `Room ${room.roomNumber}: housekeeping ${data.action === "start" ? "started assigned maintenance work" : "submitted maintenance work notes for manager review"}.`, issue._id, session);
        return { _id: issue._id, status: issue.status, workNotes: issue.workNotes || "" };
    });
}

async function notifyHotelAfterSave(actor) {
    try {
        await publishHotelUpdate(actor.hotelId);
    } catch {
        console.error(
            "Housekeeping real-time update could not be delivered"
        );
    }
}

export async function updateCleaning(actor, key, data) {
    const result = await performUpdateCleaning(
        actor,
        key,
        data
    );

    await notifyHotelAfterSave(actor);

    return result;
}

export async function createIssue(actor, data) {
    const result = await performCreateIssue(
        actor,
        data
    );

    await notifyHotelAfterSave(actor);

    return result;
}

export async function updateAssignedIssue(actor, key, data) {
    const result = await performUpdateAssignedIssue(
        actor,
        key,
        data
    );

    await notifyHotelAfterSave(actor);

    return result;
}