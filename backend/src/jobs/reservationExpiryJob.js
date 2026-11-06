import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import RoomNight from "../models/RoomNight.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import { trySendBookingEmail } from "../services/bookingEmailService.js";

const EXPIRY_HOURS = 24;
const INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 100;

export async function expirePendingReservations() {
    const cutoff = new Date(
        Date.now() - EXPIRY_HOURS * 60 * 60 * 1000
    );

    const candidates = await Booking.find({
        status: "pending_approval",
        createdAt: {
            $lte: cutoff
        }
    })
        .select("_id")
        .sort({
            createdAt: 1,
            _id: 1
        })
        .limit(BATCH_SIZE)
        .lean();

    let expired = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
        const session = await mongoose.startSession();

        try {
            const changed = await session.withTransaction(
                async () => {
                    // Recheck status inside the transaction.
                    const booking = await Booking.findOne({
                        _id: candidate._id,
                        status: "pending_approval",
                        createdAt: {
                            $lte: cutoff
                        }
                    }).session(session);

                    if (!booking) {
                        return false;
                    }

                    // Use the same room lock as approval,
                    // cancellation and payment workflows.
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

                    if (!room) {
                        throw new Error(
                            "Reservation expiry could not find its room"
                        );
                    }

                    const invoice = await Invoice.findOne({
                        bookingId: booking._id,
                        hotelId: booking.hotelId
                    }).session(session);

                    if (!invoice) {
                        throw new Error(
                            "Reservation expiry could not find its invoice"
                        );
                    }

                    const hasPayments =
                        invoice.paid > 0 ||
                        (invoice.payments || []).some(
                            payment => payment.amount > 0
                        );

                    // Never discard an existing payment.
                    if (hasPayments) {
                        return false;
                    }

                    booking.status = "cancelled";

                    await booking.save({ session });

                    await RoomNight.deleteMany({
                        bookingId: booking._id
                    }).session(session);

                    invoice.chargeItems = [];
                    invoice.subtotal = 0;
                    invoice.tax = 0;
                    invoice.discount = 0;
                    invoice.grandTotal = 0;
                    invoice.paid = 0;
                    invoice.balance = 0;

                    // Existing schema uses "paid" for
                    // invoices with zero outstanding amount.
                    invoice.status = "paid";

                    await invoice.save({ session });

                    const staff = await mongoose.model("User")
                        .find({
                            isActive: true,
                            $or: [
                                {
                                    role: "Admin"
                                },
                                {
                                    role: "Manager",
                                    hotelId: booking.hotelId
                                }
                            ]
                        })
                        .select("_id")
                        .session(session);

                    const recipients = new Set(
                        staff.map(user => String(user._id))
                    );

                    if (booking.guestId) {
                        recipients.add(
                            String(booking.guestId)
                        );
                    }

                    if (recipients.size) {
                        await Notification.insertMany(
                            [...recipients].map(
                                recipientId => ({
                                    recipientId,
                                    type: "booking",

                                    message:
                                        `Reservation ${booking.reference} ` +
                                        `expired after ${EXPIRY_HOURS} hours ` +
                                        "without approval and was automatically " +
                                        "cancelled. No amount is due. " +
                                        "Please submit a new request if needed.",

                                    reference: String(booking._id)
                                })
                            ),
                            { session }
                        );
                    }

                    return true;
                }
            );

           if (changed) {
    expired += 1;

    // The cancellation transaction has completed.
    // Inform the guest that the request expired.
    await trySendBookingEmail(
        candidate._id,
        "expired"
    );
} else {
    skipped += 1;
}

            // Do not log Guest details or connection secrets.
            console.error(
                "A pending reservation could not be expired. Check database connectivity and reservation consistency."
            );
        } finally {
            await session.endSession();
        }
    }

    return {
        examined: candidates.length,
        expired,
        skipped,
        failed
    };
}

export function startReservationExpiryJob() {
    let stopped = false;
    let timer;
    let running;

    function schedule() {
        if (stopped) return;

        timer = setTimeout(run, INTERVAL_MS);
        timer.unref?.();
    }

    function run() {
        if (stopped) return;

        running = expirePendingReservations()
            .then(result => {
                if (result.expired > 0) {
                    console.log(
                        `Expired ${result.expired} pending reservation(s).`
                    );
                }
            })
            .catch(() => {
                console.error(
                    "Reservation expiry job failed. Check database connectivity."
                );
            })
            .finally(() => {
                schedule();
            });
    }

    // Process overdue requests when the backend starts.
    run();

    // Stop scheduling and finish any active transaction.
    return async function stopReservationExpiryJob() {
        stopped = true;
        clearTimeout(timer);

        if (running) {
            await running;
        }
    };
}