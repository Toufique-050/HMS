import mongoose from "mongoose";

import User from "../models/User.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import RoomNight from "../models/RoomNight.js";
import Invoice from "../models/Invoice.js";
import Service from "../models/Service.js";
import ServiceRequest from "../models/ServiceRequest.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Feedback from "../models/Feedback.js";
import Notification from "../models/Notification.js";

import {
    assert,
    today
} from "../admin/rules.js";

async function transaction(callback) {
    const session = await mongoose.startSession();

    try {
        return await session.withTransaction(
            () => callback(session)
        );
    } finally {
        await session.endSession();
    }
}

async function ownedBooking(
    actor,
    bookingId,
    session
) {
    const booking = await Booking.findOne({
        _id: bookingId,
        guestId: actor._id
    }).session(session);

    assert(
        booking,
        "Booking not found",
        404
    );

    return booking;
}

async function activeGuest(actor, session) {
    const user = await User.exists({
        _id: actor._id,
        role: "Guest",
        isActive: true,
        tokenVersion: actor.tokenVersion
    }).session(session);

    assert(
        user,
        "Session ended. Please log in again",
        401
    );
}

async function lockRoom(booking, session) {
    const room = await Room.findOneAndUpdate(
        {
            _id: booking.roomId,
            hotelId: booking.hotelId
        },
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

    assert(
        room,
        "Room not found",
        404
    );

    return room;
}

async function requireActiveHotel(
    hotelId,
    session
) {
    const hotel = await Hotel.exists({
        _id: hotelId,
        isActive: true
    }).session(session);

    assert(
        hotel,
        "This hotel is currently unavailable",
        409
    );
}

async function notifyHotel(
    actor,
    hotelId,
    message,
    reference,
    session
) {
    const staff = await User.find({
        isActive: true,

        $or: [
            {
                role: "Admin"
            },
            {
                hotelId,

                role: {
                    $in: [
                        "Manager",
                        "Receptionist"
                    ]
                }
            }
        ]
    })
        .select("_id")
        .session(session);

    const recipients = new Set([
        String(actor._id),
        ...staff.map(user => String(user._id))
    ]);

    await Notification.insertMany(
        [...recipients].map(recipientId => ({
            recipientId,
            type: "guest",
            message,
            reference: String(reference)
        })),
        { session }
    );
}

// Cancel an owned pending or confirmed reservation.
export async function cancelBooking(
    actor,
    bookingId
) {
    return transaction(async session => {
        await activeGuest(actor, session);

        const booking = await ownedBooking(
            actor,
            bookingId,
            session
        );

        await lockRoom(booking, session);

        // A repeated cancellation must not perform another mutation.
        if (booking.status === "cancelled") {
            return {
                message: "This reservation is already cancelled"
            };
        }

        assert(
            [
                "pending_approval",
                "confirmed"
            ].includes(booking.status),
            "Only pending or confirmed reservations can be cancelled",
            409
        );

        const pending =
            booking.status === "pending_approval";

        const arrival = booking.checkIn
            .toISOString()
            .slice(0, 10);

        if (pending) {
            // Pending requests have not been approved for arrival.
            // Allow cancellation, including on the arrival date.
        } else {
            assert(
                arrival > today(),
                "For arrival-day or past confirmed reservations, contact the hotel",
                409
            );
        }

        const invoice = await Invoice.findOne({
            bookingId: booking._id,
            hotelId: booking.hotelId
        }).session(session);

        assert(
            invoice,
            "Invoice not found",
            409
        );

        const hasPayments =
            invoice.paid > 0 ||
            (invoice.payments || []).some(
                payment => payment.amount > 0
            );

        assert(
            !hasPayments,
            "This reservation has a payment. Contact the hotel for cancellation and refund arrangements.",
            409
        );

        booking.status = "cancelled";

        await booking.save({ session });

        // Release all nights held by the cancelled reservation.
        await RoomNight.deleteMany({
            bookingId: booking._id
        }).session(session);

        // No payment was received, so clear the unpaid charges.
        invoice.chargeItems = [];
        invoice.subtotal = 0;
        invoice.tax = 0;
        invoice.discount = 0;
        invoice.grandTotal = 0;
        invoice.paid = 0;
        invoice.balance = 0;

        // Existing invoice schema has no cancelled/void state.
        // A zero-value invoice has no outstanding balance.
        invoice.status = "paid";

        await invoice.save({ session });

        await notifyHotel(
            actor,
            booking.hotelId,
            `Reservation ${booking.reference} cancelled by the guest.`,
            booking._id,
            session
        );

        return {
            message:
                "Reservation cancelled and room availability released"
        };
    });
}

// Service requests are allowed only during a checked-in stay.
export async function requestService(
    actor,
    data
) {
    return transaction(async session => {
        await activeGuest(actor, session);

        const booking = await ownedBooking(
            actor,
            data.bookingId,
            session
        );

        await lockRoom(booking, session);

        await requireActiveHotel(
            booking.hotelId,
            session
        );

        assert(
            booking.status === "checked_in",
            "Services can be requested during an active checked-in stay",
            409
        );

        const service = await Service.findOne({
            _id: data.serviceId,
            hotelId: booking.hotelId,
            isActive: true
        }).session(session);

        assert(
            service,
            "Service is unavailable for this hotel",
            404
        );

        let scheduledAt;

        if (data.scheduledAt) {
            scheduledAt = new Date(data.scheduledAt);

            assert(
                Number.isFinite(scheduledAt.getTime()),
                "Invalid service schedule"
            );

            assert(
                scheduledAt.getTime() >=
                Date.now() - 60000,
                "Choose a current or future service time"
            );

            assert(
                scheduledAt < booking.checkOut,
                "Service time must be before the stay's check-out date"
            );
        }

        const [request] = await ServiceRequest.create(
            [{
                hotelId: booking.hotelId,
                bookingId: booking._id,
                serviceId: service._id,
                quantity: data.quantity,
                priceSnapshot: service.price,
                scheduledAt,
                notes: data.notes,
                status: "pending"
            }],
            { session }
        );

        await notifyHotel(
            actor,
            booking.hotelId,
            `${booking.reference}: new ${service.name} request.`,
            request._id,
            session
        );

        return {
            _id: request._id,
            status: request.status
        };
    });
}

// Maintenance reporting is allowed during a checked-in stay.
export async function reportMaintenance(
    actor,
    data
) {
    return transaction(async session => {
        await activeGuest(actor, session);

        const booking = await ownedBooking(
            actor,
            data.bookingId,
            session
        );

        await lockRoom(booking, session);

        await requireActiveHotel(
            booking.hotelId,
            session
        );

        assert(
            booking.status === "checked_in",
            "Room issues can be reported during an active checked-in stay",
            409
        );

        const [request] = await MaintenanceRequest.create(
            [{
                hotelId: booking.hotelId,
                roomId: booking.roomId,
                bookingId: booking._id,
                reportedBy: actor._id,
                issue: data.issue,
                priority: data.priority,
                status: "open"
            }],
            { session }
        );

        await notifyHotel(
            actor,
            booking.hotelId,
            `${booking.reference}: ${data.priority} maintenance issue reported.`,
            request._id,
            session
        );

        return {
            _id: request._id,
            status: request.status
        };
    });
}

// Feedback is allowed once per completed stay.
export async function submitFeedback(
    actor,
    data
) {
    return transaction(async session => {
        await activeGuest(actor, session);

        const booking = await ownedBooking(
            actor,
            data.bookingId,
            session
        );

        await lockRoom(booking, session);

        assert(
            booking.status === "checked_out",
            "Feedback is available after checkout",
            409
        );

        const existing = await Feedback.exists({
            bookingId: booking._id
        }).session(session);

        assert(
            !existing,
            "Feedback has already been submitted for this stay",
            409
        );

        const [feedback] = await Feedback.create(
            [{
                bookingId: booking._id,
                guestId: actor._id,
                rating: data.rating,
                comment: data.comment
            }],
            { session }
        );

        await notifyHotel(
            actor,
            booking.hotelId,
            `${booking.reference}: guest submitted a ${data.rating}/5 rating.`,
            feedback._id,
            session
        );

        return {
            _id: feedback._id,
            rating: feedback.rating,
            comment: feedback.comment
        };
    });
}