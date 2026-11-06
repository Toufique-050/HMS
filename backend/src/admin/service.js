import { scopedFilter } from "../utils/operationScope.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";

import * as M from "./models.js";
import {
    publishHotelUpdate
} from "../realtime/socketServer.js";
import { trySendBookingEmail } from "../services/bookingEmailService.js";
import { emailPaymentReceipt } from "./mail.js";

import {
    parse,
    schemas,
    actions,
    id,
    passwordSchema,
    assert,
    totals,
    nights,
    today
} from "./rules.js";

const activeReservationStatuses = [
    "pending_approval",
    "confirmed",
    "checked_in"
];

const transaction = async callback => {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(
            () => callback(session)
        );
    } finally {
        await session.endSession();
    }
};

async function get(
    Model,
    key,
    session,
    extra = {}
) {
    parse(id, String(key));

    const doc = await Model.findOne(
        scopedFilter(Model.modelName, {
            _id: key,
            ...extra
        })
    ).session(session || null);

    assert(doc, "Record not found", 404);

    return doc;
}

async function activeHotel(key, session) {
    return get(
        M.Hotel,
        key,
        session,
        { isActive: true }
    );
}

async function lockRoom(key, session) {
    parse(id, String(key));

    const room = await M.Room.findOneAndUpdate(
        scopedFilter("Room", {
            _id: key
        }),
        {
            $inc: {
                bookingVersion: 1
            }
        },
        {
            new: true,
            session
        }
    );

    assert(room, "Room not found", 404);

    return room;
}

async function assignee(
    key,
    hotelId,
    housekeeping,
    session
) {
    if (!key) return;

    const staff = await get(
        M.User,
        key,
        session,
        { isActive: true }
    );

    const validRole = housekeeping
        ? staff.role === "Housekeeping"
        : ["Manager", "Housekeeping"].includes(staff.role);

    assert(
        String(staff.hotelId) === String(hotelId) &&
        validRole,
        "Choose active staff with the correct role in this hotel"
    );
}

async function notify(
    userId,
    message,
    reference,
    session
) {
    if (!userId) return;

    await M.Notification.create(
        [{
            recipientId: userId,
            type: "admin",
            message,
            reference: String(reference)
        }],
        { session }
    );
}

async function saveInvoice(invoice, session) {
    Object.assign(invoice, totals(invoice));

    await invoice.save({ session });

    return invoice;
}

function hasPayments(invoice) {
    return (
        invoice.paid > 0 ||
        (invoice.payments || []).some(
            payment => payment.amount > 0
        )
    );
}

export async function create(resource, input, actor) {
    const payload = resource === "staff"
        ? (({ password, ...rest }) => rest)(input)
        : input;

    const data = parse(
        schemas[resource],
        payload
    );

    if (resource === "staff") {
        const password = parse(
            passwordSchema,
            input.password
        );

        await activeHotel(data.hotelId);

        const user = await M.User.create({
            ...data,
            passwordHash: await bcrypt.hash(password, 12)
        });

        return { _id: user._id };
    }

    assert(
        resource !== "guests",
        "Guests register themselves; use a walk-in reservation",
        405
    );

    if (resource === "bookings") {
        return createBooking(data, actor);
    }

    if (resource === "service-requests") {
        return createRequest(data, actor);
    }

    if (["housekeeping", "maintenance"].includes(resource)) {
        return transaction(async session => {
            const room = await lockRoom(
                data.roomId,
                session
            );

            await assignee(
                data.assignedTo,
                room.hotelId,
                resource === "housekeeping",
                session
            );

            const [doc] = await M.resources[resource].create(
                [{
                    ...data,
                    hotelId: room.hotelId,
                    ...(resource === "maintenance"
                        ? { reportedBy: actor._id }
                        : {})
                }],
                { session }
            );

            await notify(
                data.assignedTo,
                `New ${resource} assignment`,
                doc._id,
                session
            );

            await notify(
                actor._id,
                `${resource} request created`,
                doc._id,
                session
            );

            return doc;
        });
    }

    if (data.hotelId) {
        await activeHotel(data.hotelId);
    }

    if (resource === "rooms") {
        const type = await get(
            M.RoomType,
            data.roomTypeId,
            null,
            { isActive: true }
        );

        assert(
            String(type.hotelId) === String(data.hotelId),
            "Room type belongs to another hotel"
        );
    }

    assert(
        [
            "hotels",
            "room-types",
            "rooms",
            "services",
            "settings"
        ].includes(resource),
        "Create is not supported",
        405
    );

    return M.resources[resource].create(data);
}

export async function update(
    resource,
    key,
    input,
    actor
) {
    const data = parse(schemas[resource], input);

    assert(
        [
            "hotels",
            "staff",
            "guests",
            "room-types",
            "rooms",
            "services",
            "settings"
        ].includes(resource),
        "Use the workflow actions to update this record",
        405
    );

    return transaction(async session => {
        const doc = resource === "rooms"
            ? await lockRoom(key, session)
            : await get(
                M.resources[resource],
                key,
                session
            );

        if (resource === "staff") {
            assert(
                [
                    "Manager",
                    "Receptionist",
                    "Housekeeping"
                ].includes(doc.role),
                "Admin accounts cannot be changed here"
            );

            assert(
                String(doc._id) !== String(actor._id),
                "Cannot change your own access"
            );

            if (
                String(doc.hotelId) !== String(data.hotelId) ||
                doc.role !== data.role ||
                !data.isActive
            ) {
                const pending = await M.HousekeepingTask.exists({
                    assignedTo: doc._id,
                    status: { $ne: "completed" }
                }).session(session);

                const maintenance =
                    await M.MaintenanceRequest.exists({
                        assignedTo: doc._id,
                        status: { $ne: "resolved" }
                    }).session(session);

                assert(
                    !pending && !maintenance,
                    "Reassign unfinished work before changing staff access"
                );
            }

            const current = await M.User.findById(key)
                .select("+tokenVersion")
                .session(session);

            doc.tokenVersion = current.tokenVersion + 1;
        }

        if (resource === "guests") {
            assert(
                doc.role === "Guest",
                "Guest not found",
                404
            );

            const current = await M.User.findById(key)
                .select("+tokenVersion")
                .session(session);

            doc.tokenVersion = current.tokenVersion + 1;
        }

        if (data.hotelId) {
            if (!["staff", "settings"].includes(resource)) {
                assert(
                    String(doc.hotelId) === String(data.hotelId),
                    "Hotel cannot be changed after creation"
                );
            }

            await activeHotel(data.hotelId, session);
        }

        if (
            resource === "room-types" &&
            (
                data.capacity < doc.capacity ||
                !data.isActive
            )
        ) {
            const rooms = await M.Room.find({
                roomTypeId: doc._id
            })
                .select("_id")
                .session(session);

            const activeBookings = await M.Booking.exists({
                roomId: {
                    $in: rooms.map(room => room._id)
                },
                status: {
                    $in: activeReservationStatuses
                }
            }).session(session);

            assert(
                !activeBookings,
                "Resolve pending and active reservations before reducing capacity or archiving a room type"
            );

            if (!data.isActive) {
                const activeRooms = await M.Room.exists({
                    roomTypeId: doc._id,
                    isActive: true
                }).session(session);

                assert(
                    !activeRooms,
                    "Archive active rooms before their room type"
                );
            }
        }

        if (resource === "rooms") {
            assert(
                String(doc.roomTypeId) === String(data.roomTypeId),
                "Create a new room to change its room type"
            );

            if (!data.isActive) {
                assert(
                    doc.occupancyStatus === "vacant",
                    "Occupied room cannot be archived"
                );

                const reserved = await M.RoomNight.exists({
                    roomId: doc._id,
                    date: {
                        $gte: new Date(today())
                    }
                }).session(session);

                assert(
                    !reserved,
                    "Room has pending or active reservations"
                );
            }
        }

        if (resource === "hotels" && !data.isActive) {
            const staff = await M.User.exists({
                hotelId: doc._id,
                isActive: true
            }).session(session);

            const rooms = await M.Room.exists({
                hotelId: doc._id,
                isActive: true
            }).session(session);

            const bookings = await M.Booking.exists({
                hotelId: doc._id,
                status: {
                    $in: activeReservationStatuses
                }
            }).session(session);

            assert(
                !staff && !rooms && !bookings,
                "Deactivate staff and rooms and resolve pending/active reservations first"
            );
        }

        Object.assign(doc, data);

        await doc.save({ session });

        return { _id: doc._id };
    });
}

async function createBooking(data, actor) {
    const dates = nights(
        data.checkIn,
        data.checkOut
    );

    assert(
        data.checkIn >= today(),
        "Check-in cannot be in the past (hotel timezone: Asia/Karachi)"
    );

    return transaction(async session => {
        const room = await lockRoom(
            data.roomId,
            session
        );

        assert(
            room.isActive &&
            room.maintenanceStatus === "operational",
            "Room is unavailable"
        );

        await activeHotel(room.hotelId, session);

        const type = await get(
            M.RoomType,
            String(room.roomTypeId),
            session,
            { isActive: true }
        );

        assert(
            data.guests <= type.capacity,
            "Guest count exceeds room capacity"
        );

        if (data.guestId) {
            await get(
                M.User,
                data.guestId,
                session,
                {
                    role: "Guest",
                    isActive: true
                }
            );
        }

        const settings = await M.Setting.findOne({
            hotelId: room.hotelId
        }).session(session);

        const reference =
            "BK-" + randomUUID().slice(0, 8).toUpperCase();

        // Staff-created bookings retain the existing confirmed flow.
        const [booking] = await M.Booking.create(
            [{
                reference,
                guestId: data.guestId,

                guestSnapshot: {
                    name: data.guestName,
                    phone: data.guestPhone,
                    email: data.guestEmail
                },

                hotelId: room.hotelId,
                roomId: room._id,
                roomTypeId: type._id,

                checkIn: data.checkIn,
                checkOut: data.checkOut,
                guests: data.guests,
                rateSnapshot: type.baseRate,
                status: "confirmed",
                paymentPreference: "not_selected"
            }],
            { session }
        );

        await M.RoomNight.insertMany(
            dates.map(date => ({
                roomId: room._id,
                date,
                bookingId: booking._id
            })),
            { session }
        );

        const invoice = new M.Invoice({
            number:
                `${settings?.invoicePrefix || "LS"}-` +
                randomUUID().slice(0, 12).toUpperCase(),

            bookingId: booking._id,
            hotelId: room.hotelId,

            chargeItems: [{
                label:
                    `Room ${room.roomNumber}: ` +
                    `${dates.length} night(s)`,

                quantity: dates.length,
                unitPrice: type.baseRate,
                sourceId: "room"
            }],

            taxRate: settings?.taxRate || 0,
            discount: 0,
            payments: []
        });

        await saveInvoice(invoice, session);

        await notify(
            data.guestId,
            `Booking ${reference} confirmed`,
            booking._id,
            session
        );

        await notify(
            actor._id,
            `Booking ${reference} created`,
            booking._id,
            session
        );

        return booking;
    });
}

async function createRequest(data, actor) {
    return transaction(async session => {
        const booking = await get(
            M.Booking,
            data.bookingId,
            session,
            { status: "checked_in" }
        );

        await lockRoom(
            String(booking.roomId),
            session
        );

        const service = await get(
            M.Service,
            data.serviceId,
            session,
            { isActive: true }
        );

        assert(
            String(service.hotelId) === String(booking.hotelId),
            "Service belongs to another hotel"
        );

        const [doc] = await M.ServiceRequest.create(
            [{
                ...data,
                hotelId: booking.hotelId,
                priceSnapshot: service.price
            }],
            { session }
        );

        await notify(
            actor._id,
            "Service request created",
            doc._id,
            session
        );

        return doc;
    });
}

async function performAction(
    resource,
    key,
    operation,
    input,
    actor
) {
    const data = parse(actions[operation], input);

    if (operation === "email") {
        assert(
            resource === "invoices",
            "Invalid action"
        );

        const { emailInvoice } = await import("./mail.js");

        return emailInvoice(
            await get(M.Invoice, key)
        );
    }

    return transaction(async session => {
        const Model = M.resources[resource];

        assert(
            Model,
            "Resource not found",
            404
        );

        if (resource === "rooms") {
            assert(
                operation === "readiness",
                "Invalid room action"
            );

            const room = await lockRoom(key, session);

            const tasks = await M.HousekeepingTask.exists({
                roomId: room._id,
                status: { $ne: "completed" }
            }).session(session);

            const issues = await M.MaintenanceRequest.exists({
                roomId: room._id,
                status: { $ne: "resolved" }
            }).session(session);

            assert(
                !(data.housekeepingStatus === "clean" && tasks),
                "Complete cleaning tasks before marking the room clean"
            );

            assert(
                !(data.maintenanceStatus === "operational" && issues),
                "Resolve maintenance issues before marking the room operational"
            );

            if (data.maintenanceStatus === "out_of_service") {
                assert(
                    room.occupancyStatus === "vacant",
                    "Move/check out the guest first"
                );

                const reserved = await M.RoomNight.exists({
                    roomId: room._id,
                    date: {
                        $gte: new Date(today())
                    }
                }).session(session);

                assert(
                    !reserved,
                    "Resolve pending and active reservations before removing the room from service"
                );
            }

            Object.assign(room, data);

            await room.save({ session });

            return room;
        }

        const doc = await get(
            Model,
            key,
            session
        );

        if (resource === "bookings") {
            const room = await lockRoom(
                String(doc.roomId),
                session
            );

            const settings = await M.Setting.findOne({
                hotelId: doc.hotelId
            }).session(session);

            if (operation === "extend") {
                assert(
                    ["confirmed", "checked_in"].includes(doc.status),
                    "Only confirmed or checked-in stays can be extended",
                    409
                );

                assert(
                    data.checkOut >
                        doc.checkOut.toISOString().slice(0, 10) &&
                    data.checkOut > today(),
                    "Choose a later future checkout date"
                );

                const addedDates = nights(
                    doc.checkOut,
                    data.checkOut
                );

                const allDates = nights(
                    doc.checkIn,
                    data.checkOut
                );

                await M.RoomNight.insertMany(
                    addedDates.map(date => ({
                        roomId: room._id,
                        date,
                        bookingId: doc._id
                    })),
                    { session }
                );

                const invoice = await M.Invoice.findOne({
                    bookingId: doc._id
                }).session(session);

                assert(invoice, "Invoice not found");

                const charge = invoice.chargeItems.find(
                    item => item.sourceId === "room"
                );

                assert(charge, "Room charge not found");

                charge.quantity = allDates.length;
                charge.label =
                    `Room ${room.roomNumber}: ` +
                    `${allDates.length} night(s)`;

                await saveInvoice(invoice, session);

                doc.checkOut = new Date(data.checkOut);
            } else if (operation === "change-room") {
                assert(
                    ["confirmed", "checked_in"].includes(doc.status),
                    "Only confirmed or checked-in reservations can change rooms",
                    409
                );

                assert(
                    data.roomId !== String(room._id),
                    "Choose another room"
                );

                const next = await lockRoom(
                    data.roomId,
                    session
                );

                assert(
                    String(next.hotelId) === String(doc.hotelId) &&
                    next.isActive &&
                    next.maintenanceStatus === "operational",
                    "Choose an operational room in the same hotel"
                );

                const type = await get(
                    M.RoomType,
                    String(next.roomTypeId),
                    session,
                    { isActive: true }
                );

                assert(
                    type.capacity >= doc.guests,
                    "New room capacity is insufficient"
                );

                const start = doc.status === "checked_in"
                    ? new Date(today())
                    : doc.checkIn;

                assert(
                    doc.checkOut > start,
                    "Extend overdue reservations before changing rooms"
                );

                if (doc.status === "checked_in") {
                    assert(
                        next.occupancyStatus === "vacant" &&
                        next.housekeepingStatus === "clean",
                        "New room must be vacant and clean"
                    );

                    const cleaning = await M.HousekeepingTask.exists({
                        roomId: next._id,
                        status: { $ne: "completed" }
                    }).session(session);

                    const maintenance =
                        await M.MaintenanceRequest.exists({
                            roomId: next._id,
                            status: { $ne: "resolved" }
                        }).session(session);

                    assert(
                        !cleaning,
                        "New room has unfinished cleaning"
                    );

                    assert(
                        !maintenance,
                        "New room has unresolved maintenance"
                    );
                }

                await M.RoomNight.deleteMany(
                    {
                        bookingId: doc._id,
                        date: { $gte: start }
                    },
                    { session }
                );

                await M.RoomNight.insertMany(
                    nights(start, doc.checkOut).map(date => ({
                        roomId: next._id,
                        date,
                        bookingId: doc._id
                    })),
                    { session }
                );

                if (doc.status === "checked_in") {
                    room.occupancyStatus = "vacant";
                    room.housekeepingStatus = "dirty";
                    next.occupancyStatus = "occupied";

                    await M.HousekeepingTask.create(
                        [{
                            hotelId: doc.hotelId,
                            roomId: room._id,
                            scheduledAt: new Date(),
                            notes: "Room reassignment cleaning"
                        }],
                        { session }
                    );
                }

                await next.save({ session });

                doc.roomId = next._id;
                doc.roomTypeId = next.roomTypeId;

                const invoice = await M.Invoice.findOne({
                    bookingId: doc._id
                }).session(session);

                assert(invoice, "Invoice not found");

                const charge = invoice.chargeItems.find(
                    item => item.sourceId === "room"
                );

                assert(charge, "Room charge not found");

                charge.label =
                    `Room stay: ${charge.quantity} night(s), ` +
                    `current room ${next.roomNumber}`;

                await saveInvoice(invoice, session);
            } else if (operation === "check-in") {
                assert(
                    doc.status === "confirmed",
                    "Only approved/confirmed reservations can check in",
                    409
                );

                assert(
                    doc.checkIn.toISOString().slice(0, 10) <= today() &&
                    doc.checkOut.toISOString().slice(0, 10) > today(),
                    "Check-in must occur during the reserved stay"
                );

                assert(
                    room.isActive &&
                    room.occupancyStatus === "vacant" &&
                    room.housekeepingStatus === "clean" &&
                    room.maintenanceStatus === "operational",
                    "Room must be vacant, clean and operational"
                );

                const maintenance =
                    await M.MaintenanceRequest.exists({
                        roomId: room._id,
                        status: { $ne: "resolved" }
                    }).session(session);

                const cleaning = await M.HousekeepingTask.exists({
                    roomId: room._id,
                    status: { $ne: "completed" }
                }).session(session);

                assert(
                    !maintenance,
                    "Resolve room maintenance before check-in"
                );

                assert(
                    !cleaning,
                    "Complete room cleaning before check-in"
                );

                doc.status = "checked_in";
                doc.keyReference = data.keyReference;
                doc.actualCheckIn = new Date();

                room.occupancyStatus = "occupied";
            } else if (operation === "check-out") {
                assert(
                    doc.status === "checked_in",
                    "Only checked-in stays can check out",
                    409
                );

                assert(
                    doc.checkOut.toISOString().slice(0, 10) >= today(),
                    "Stay is overdue; resolve extension and billing before checkout"
                );

                const invoice = await M.Invoice.findOne({
                    bookingId: doc._id
                }).session(session);

                assert(invoice, "Invoice is missing");

                const unfinished = await M.ServiceRequest.exists({
                    bookingId: doc._id,
                    status: {
                        $in: ["pending", "accepted"]
                    }
                }).session(session);

                assert(
                    !unfinished,
                    "Complete or cancel outstanding service requests first"
                );

                assert(
                    settings?.allowOutstandingCheckout ||
                    invoice.balance === 0,
                    "Settle the outstanding invoice before checkout"
                );

                doc.status = "checked_out";
                doc.actualCheckOut = new Date();

                room.occupancyStatus = "vacant";
                room.housekeepingStatus = "dirty";

                await M.RoomNight.deleteMany(
                    {
                        bookingId: doc._id,
                        date: {
                            $gte: new Date(today())
                        }
                    },
                    { session }
                );

                await M.HousekeepingTask.create(
                    [{
                        hotelId: doc.hotelId,
                        roomId: room._id,
                        scheduledAt: new Date(),
                        notes: `Checkout: ${doc.reference}`
                    }],
                    { session }
                );
            } else if (
                ["cancel", "no-show"].includes(operation)
            ) {
                if (operation === "cancel") {
                    assert(
                        [
                            "pending_approval",
                            "confirmed"
                        ].includes(doc.status),
                        "Only pending or confirmed reservations can be cancelled",
                        409
                    );
                } else {
                    assert(
                        doc.status === "confirmed",
                        "Only confirmed reservations can be marked no-show",
                        409
                    );

                    assert(
                        doc.checkIn.toISOString().slice(0, 10) < today(),
                        "No-show can be recorded after the arrival date"
                    );
                }

                const invoice = await M.Invoice.findOne({
                    bookingId: doc._id
                }).session(session);

                assert(invoice, "Invoice not found");

                assert(
                    !hasPayments(invoice),
                    "Paid reservations need a refund workflow before cancellation"
                );

                doc.status = operation === "cancel"
                    ? "cancelled"
                    : "no_show";

                invoice.chargeItems = [];
                invoice.discount = 0;

                await saveInvoice(invoice, session);

                await M.RoomNight.deleteMany(
                    { bookingId: doc._id },
                    { session }
                );
            } else {
                assert(
                    false,
                    "Use Reservation approvals to approve or reject requests",
                    405
                );
            }

            await room.save({ session });
            await doc.save({ session });

            await notify(
                doc.guestId,
                `Booking ${doc.reference}: ${doc.status}`,
                doc._id,
                session
            );

            return doc;
        }

        if (resource === "invoices") {
            const booking = await get(
                M.Booking,
                String(doc.bookingId),
                session
            );

            await lockRoom(
                String(booking.roomId),
                session
            );

            if (operation === "payment") {
                assert(
                    [
                        "confirmed",
                        "checked_in",
                        "checked_out"
                    ].includes(booking.status),
                    "Payment can only be recorded for confirmed, checked-in or checked-out reservations",
                    409
                );

                const previous = doc.payments.find(
                    payment => payment.key === data.key
                );

                if (previous) {
                    assert(
                        previous.amount === data.amount &&
                        previous.method === data.method &&
                        previous.reference === data.reference,
                        "Payment key was already used with different details",
                        409
                    );

                    return doc;
                }

                assert(
                    data.amount <= doc.balance,
                    "Payment exceeds outstanding balance"
                );

                doc.payments.push({
                    ...data,
                    paidAt: new Date(),
                    recordedBy: actor._id
                });
            } else if (operation === "discount") {
                assert(
                    [
                        "confirmed",
                        "checked_in"
                    ].includes(booking.status),
                    "Discounts are only allowed for confirmed or checked-in reservations",
                    409
                );

                doc.discount = data.discount;
            } else {
                assert(false, "Invalid invoice action");
            }

            return saveInvoice(doc, session);
        }

        if (
            resource === "housekeeping" ||
            resource === "maintenance"
        ) {
            const room = await lockRoom(
                String(doc.roomId),
                session
            );

            const finished = resource === "housekeeping"
                ? "completed"
                : "resolved";

            assert(
                doc.status !== finished,
                "Completed work cannot be changed"
            );

            if (operation === "assign") {
                await assignee(
                    data.assignedTo,
                    doc.hotelId,
                    resource === "housekeeping",
                    session
                );

                doc.assignedTo = data.assignedTo;

                await notify(
                    data.assignedTo,
                    `New ${resource} assignment`,
                    doc._id,
                    session
                );
            } else {
                assert(
                    operation === "status",
                    "Invalid action"
                );

                const allowed = resource === "housekeeping"
                    ? {
                        pending: ["in_progress"],
                        in_progress: ["completed"]
                    }
                    : {
                        open: ["in_progress"],
                        in_progress: ["resolved"]
                    };

                assert(
                    allowed[doc.status]?.includes(data.status),
                    "Invalid status transition"
                );

                if (resource === "housekeeping") {
                    assert(
                        doc.assignedTo,
                        "Assign housekeeping staff first"
                    );

                    assert(
                        room.occupancyStatus === "vacant",
                        "Guest must leave before checkout cleaning"
                    );

                    room.housekeepingStatus =
                        data.status === "completed"
                            ? "clean"
                            : "cleaning";

                    if (data.status === "completed") {
                        doc.completedAt = new Date();

                        const unfinished =
                            await M.HousekeepingTask.exists({
                                _id: { $ne: doc._id },
                                roomId: room._id,
                                status: { $ne: "completed" }
                            }).session(session);

                        if (unfinished) {
                            room.housekeepingStatus = "dirty";
                        }
                    }
                } else if (data.status === "resolved") {
                    assert(
                        data.resolution.trim(),
                        "Enter the resolution notes"
                    );

                    doc.resolution = data.resolution;

                    const unresolved =
                        await M.MaintenanceRequest.exists({
                            _id: { $ne: doc._id },
                            roomId: room._id,
                            status: { $ne: "resolved" }
                        }).session(session);

                    if (!unresolved) {
                        room.maintenanceStatus = "operational";
                    }
                }

                doc.status = data.status;
            }

            await room.save({ session });
            await doc.save({ session });

            return doc;
        }

        if (resource === "service-requests") {
            assert(
                operation === "status",
                "Invalid action"
            );

            const booking = await get(
                M.Booking,
                String(doc.bookingId),
                session,
                { status: "checked_in" }
            );

            await lockRoom(
                String(booking.roomId),
                session
            );

            const allowed = {
                pending: ["accepted", "cancelled"],
                accepted: ["completed", "cancelled"]
            };

            assert(
                allowed[doc.status]?.includes(data.status),
                "Invalid service transition"
            );

            if (data.status === "completed") {
                const service = await get(
                    M.Service,
                    String(doc.serviceId),
                    session
                );

                const invoice = await M.Invoice.findOne({
                    bookingId: doc.bookingId
                }).session(session);

                assert(invoice, "Invoice not found");

                assert(
                    !invoice.chargeItems.some(
                        item => item.sourceId === String(doc._id)
                    ),
                    "Request is already billed"
                );

                invoice.chargeItems.push({
                    label: service.name,
                    quantity: doc.quantity,
                    unitPrice: doc.priceSnapshot,
                    sourceId: String(doc._id)
                });

                await saveInvoice(invoice, session);
            }

            doc.status = data.status;

            await doc.save({ session });

            return doc;
        }

        if (resource === "notifications") {
            assert(
                operation === "read" &&
                String(doc.recipientId) === String(actor._id),
                "Notification not found",
                404
            );

            doc.isRead = true;

            await doc.save({ session });

            return doc;
        }

        assert(
            false,
            "Action not supported",
            405
        );
    });
}

export async function action(
    resource,
    key,
    operation,
    input,
    actor
) {
    // This resolves after the existing transaction commits.
    const result = await performAction(
        resource,
        key,
        operation,
        input,
        actor
    );

    // Send cancellation email after the booking action commits.
if (
    resource === "bookings" &&
    operation === "cancel"
) {
    await trySendBookingEmail(
        key,
        "cancelled"
    );
}

if (
    resource === "invoices" &&
    operation === "payment"
) {
    await emailPaymentReceipt(key);
}

    const liveResources = new Set([
        "bookings",
        "rooms",
        "invoices",
        "housekeeping",
        "maintenance",
        "service-requests"
    ]);

    if (
        liveResources.has(resource) &&
        operation !== "email"
    ) {
        try {
            // Some existing actions return only the record ID.
            const record = await M.resources[resource]
                .findById(key)
                .select("hotelId")
                .lean();

            if (record?.hotelId) {
                await publishHotelUpdate(record.hotelId);
            }
        } catch {
            // A socket failure must not turn a committed
            // operation into an apparent booking/payment failure.
            console.error(
                "Real-time update could not be delivered"
            );
        }
    }

    return result;
}