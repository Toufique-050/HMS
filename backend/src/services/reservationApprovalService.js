
import mongoose from "mongoose";

import User from "../models/User.js";
import Hotel from "../models/Hotel.js";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import RoomNight from "../models/RoomNight.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";

import {
    trySendBookingEmail
} from "../services/bookingEmailService.js";

import {
    assert,
    nights,
    today
} from "../admin/rules.js";

const EXPIRY_MS = 24 * 60 * 60 * 1000;

const paymentOptions = [
    "cash",
    "card_demo",
    "jazzcash_demo",
    "easypaisa_demo"
];

function reservationFields(booking) {
    return {
        _id: booking._id,
        reference: booking.reference,
        status: booking.status,
        paymentPreference: booking.paymentPreference,
        approval: booking.approval
    };
}

function invoiceFields(invoice) {
    return {
        _id: invoice._id,
        status: invoice.status,
        grandTotal: invoice.grandTotal,
        paid: invoice.paid,
        balance: invoice.balance
    };
}

export async function reviewReservation(
    actor,
    bookingId,
    input
) {
    assert(
        mongoose.isObjectIdOrHexString(bookingId),
        "Invalid booking ID"
    );

    assert(
        input &&
        ["approve", "reject"].includes(input.decision),
        "Choose approve or reject"
    );

    assert(
        input.rejectionReason == null ||
        typeof input.rejectionReason === "string",
        "Invalid rejection reason"
    );

    const reason = (
        input.rejectionReason || ""
    ).trim();

    assert(
        reason.length <= 500,
        "Rejection reason must not exceed 500 characters"
    );

    if (input.decision === "reject") {
        assert(
            reason.length > 0,
            "Enter a reason for rejecting this reservation"
        );
    }

    const session = await mongoose.startSession();

    let result;

    try {
        result = await session.withTransaction(async () => {
            const staff = await User.findOne({
                _id: actor._id,
                isActive: true,
                tokenVersion: actor.tokenVersion
            })
                .select("_id role hotelId")
                .session(session);

            assert(
                staff,
                "Session ended. Please log in again",
                401
            );

            assert(
                staff.role === "Admin",
                "Only Admin can approve or reject reservations",
                403
            );

            const scope = {
                _id: bookingId
            };

            const booking = await Booking.findOne(scope)
                .session(session);

            assert(
                booking,
                "Reservation not found",
                404
            );

            assert(
                booking.status === "pending_approval",
                "Only pending reservations can be approved or rejected",
                409
            );

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
                "Reservation room not found",
                409
            );

            const invoice = await Invoice.findOne({
                bookingId: booking._id,
                hotelId: booking.hotelId
            }).session(session);

            assert(
                invoice,
                "Reservation invoice not found",
                409
            );

            if (input.decision === "approve") {
                const createdAt = new Date(
                    booking.createdAt
                ).getTime();

                assert(
                    Number.isFinite(createdAt),
                    "Reservation creation time is missing or invalid. Reject this request and create a new reservation.",
                    409
                );

                assert(
                    Date.now() < createdAt + EXPIRY_MS,
                    "This request has exceeded its 24-hour approval window. It cannot be approved. The expiry job will cancel it, or you can reject it now.",
                    409
                );

                const activeHotel = await Hotel.exists({
                    _id: booking.hotelId,
                    isActive: true
                }).session(session);

                assert(
                    activeHotel,
                    "This hotel is currently inactive",
                    409
                );

                assert(
                    room.isActive &&
                    room.maintenanceStatus === "operational",
                    "The allocated room must be active and operational",
                    409
                );

                const arrival = booking.checkIn
                    .toISOString()
                    .slice(0, 10);

                assert(
                    arrival >= today(),
                    "The arrival date has passed. Reject this request and create a new reservation.",
                    409
                );

                assert(
                    paymentOptions.includes(
                        booking.paymentPreference
                    ),
                    "The guest must select a payment option before approval",
                    409
                );

                const expectedDates = nights(
                    booking.checkIn,
                    booking.checkOut
                );

                const locks = await RoomNight.find({
                    bookingId: booking._id
                })
                    .select("roomId date")
                    .session(session)
                    .lean();

                const lockedDates = new Set(
                    locks.map(lock =>
                        new Date(lock.date)
                            .toISOString()
                            .slice(0, 10)
                    )
                );

                const validLocks =
                    locks.length === expectedDates.length &&
                    locks.every(lock =>
                        String(lock.roomId) ===
                        String(booking.roomId)
                    ) &&
                    expectedDates.every(date =>
                        lockedDates.has(
                            new Date(date)
                                .toISOString()
                                .slice(0, 10)
                        )
                    );

                assert(
                    validLocks,
                    "Reservation night locks are incomplete. Reject this request and create a new reservation.",
                    409
                );

                booking.status = "confirmed";

                booking.approval = {
                    reviewedBy: staff._id,
                    reviewedAt: new Date()
                };

                await booking.save({ session });
            } else {
                const hasPayments =
                    invoice.paid > 0 ||
                    (invoice.payments || []).some(
                        payment => payment.amount > 0
                    );

                assert(
                    !hasPayments,
                    "This reservation has payments. Resolve those payments before rejection.",
                    409
                );

                booking.status = "rejected";

                booking.approval = {
                    reviewedBy: staff._id,
                    reviewedAt: new Date(),
                    rejectionReason: reason
                };

                await booking.save({ session });

                await RoomNight.deleteMany({
                    bookingId: booking._id
                }).session(session);

                invoice.chargeItems = [];
                invoice.discount = 0;
                invoice.subtotal = 0;
                invoice.tax = 0;
                invoice.grandTotal = 0;
                invoice.paid = 0;
                invoice.balance = 0;

                invoice.status = "paid";

                await invoice.save({ session });
            }

            const approved =
                input.decision === "approve";

            const guestMessage = approved
                ? (
                    `Your reservation ${booking.reference} ` +
                    "has been approved and confirmed. " +
                    "Check your invoice for the payment balance."
                )
                : (
                    `Your reservation ${booking.reference} ` +
                    `has been rejected. Reason: ${reason}`
                );

            if (booking.guestId) {
                await Notification.create(
                    [{
                        recipientId: booking.guestId,
                        type: "booking",
                        message: guestMessage,
                        reference: String(booking._id)
                    }],
                    { session }
                );
            }

            return {
                message: approved
                    ? "Reservation approved successfully"
                    : "Reservation rejected and room availability released",

                item: reservationFields(booking),

                invoice: invoiceFields(invoice)
            };
        });
    } finally {
        await session.endSession();
    }

    if (input.decision === "approve") {
        await trySendBookingEmail(
            bookingId,
            "confirmed"
        );
    }

    return result;
}
