import { z } from "zod";

import * as M from "../admin/models.js";

import {
    parse,
    id,
    dateOnly,
    nights,
    today
} from "../admin/rules.js";

import {
    calculateDaily,
    makeForecast,
    round
} from "./reportMath.js";

const financialStatuses = [
    "confirmed",
    "checked_in",
    "checked_out"
];

const reportQuery = z.object({
    from: dateOnly.optional(),
    to: dateOnly.optional()
}).strict();

function eligibleInvoice(invoice) {
    return financialStatuses.includes(
        invoice.bookingId?.status
    );
}

function serializeDates(rows) {
    return rows.map(row => ({
        date: new Date(row.date).toISOString()
    }));
}

export async function managerReport(hotelId, input) {
    const assignedHotelId = parse(
        id,
        String(hotelId)
    );

    const query = parse(
        reportQuery,
        input
    );

    const to = query.to || today();

    const from = query.from ||
        new Date(
            Date.parse(to) - 29 * 86400000
        ).toISOString().slice(0, 10);

    const end = new Date(
        Date.parse(to) + 86400000
    );

    const labels = nights(
        from,
        end
    ).map(date =>
        date.toISOString().slice(0, 10)
    );

    const financialStart = new Date(
        `${from}T00:00:00+05:00`
    );

    const financialEnd = new Date(
        `${end.toISOString().slice(0, 10)}T00:00:00+05:00`
    );

    // The route supplies the authenticated Manager's hotel.
    // Query parameters cannot replace this scope.
    const scope = {
        hotelId: assignedHotelId
    };

    const rooms = await M.Room.find({
        ...scope,
        isActive: true
    })
        .select(
            "_id occupancyStatus housekeepingStatus maintenanceStatus"
        )
        .lean();

    const roomIds = rooms.map(
        room => room._id
    );

    const historyEnd = new Date(today());

    const historyStart = new Date(
        historyEnd.getTime() - 28 * 86400000
    );

    const [
        bookings,
        invoiceRows,
        nightRows,
        historicalRows,
        feedbackBookingIds,
        cleaning,
        maintenance,
        staff,
        balanceRows
    ] = await Promise.all([
        M.Booking.find({
            ...scope,

            checkIn: {
                $lt: end
            },

            checkOut: {
                $gt: new Date(from)
            }
        })
            .select("status")
            .lean(),

        M.Invoice.find({
            ...scope,

            $or: [
                {
                    createdAt: {
                        $gte: financialStart,
                        $lt: financialEnd
                    }
                },
                {
                    "payments.paidAt": {
                        $gte: financialStart,
                        $lt: financialEnd
                    }
                }
            ]
        })
            .populate(
                "bookingId",
                "status"
            )
            .lean(),

        M.RoomNight.find({
            roomId: {
                $in: roomIds
            },

            date: {
                $gte: new Date(from),
                $lt: end
            }
        })
            .select("date")
            .lean(),

        M.RoomNight.find({
            roomId: {
                $in: roomIds
            },

            date: {
                $gte: historyStart,
                $lt: historyEnd
            }
        })
            .select("date")
            .lean(),

        M.Booking.distinct(
            "_id",
            scope
        ),

        M.HousekeepingTask.countDocuments({
            ...scope,

            status: {
                $ne: "completed"
            }
        }),

        M.MaintenanceRequest.countDocuments({
            ...scope,

            status: {
                $ne: "resolved"
            }
        }),

        M.User.countDocuments({
            ...scope,

            role: {
                $ne: "Guest"
            },

            isActive: true
        }),

        M.Invoice.find(scope)
            .select("bookingId balance")
            .populate(
                "bookingId",
                "status"
            )
            .lean()
    ]);

    const invoices = invoiceRows.filter(
        eligibleInvoice
    );

    const feedback = await M.Feedback.find({
        bookingId: {
            $in: feedbackBookingIds
        },

        createdAt: {
            $gte: financialStart,
            $lt: financialEnd
        }
    })
        .sort({
            createdAt: -1,
            _id: -1
        })
        .limit(100)
        .lean();

    const daily = calculateDaily(
        labels,
        serializeDates(nightRows),
        invoices,
        rooms.length
    );

    const invoiced = round(
        invoices
            .filter(invoice => {
                const issuedAt = new Date(
                    invoice.createdAt
                );

                return (
                    issuedAt >= financialStart &&
                    issuedAt < financialEnd
                );
            })
            .reduce(
                (sum, invoice) =>
                    sum + invoice.grandTotal,
                0
            )
    );

    const outstanding = round(
        balanceRows
            .filter(eligibleInvoice)
            .reduce(
                (sum, invoice) =>
                    sum + invoice.balance,
                0
            )
    );

    return {
        from,
        to,

        rooms: rooms.length,
        staff,

        bookings: bookings.length,

        pendingApproval: bookings.filter(
            booking =>
                booking.status === "pending_approval"
        ).length,

        rejected: bookings.filter(
            booking =>
                booking.status === "rejected"
        ).length,

        confirmed: bookings.filter(
            booking =>
                booking.status === "confirmed"
        ).length,

        checkedIn: bookings.filter(
            booking =>
                booking.status === "checked_in"
        ).length,

        occupiedNow: rooms.filter(
            room =>
                room.occupancyStatus === "occupied"
        ).length,

        reservedNights: nightRows.length,

        occupancyPercent: rooms.length
            ? round(
                100 * nightRows.length /
                (rooms.length * labels.length)
            )
            : 0,

        invoiced,

        collected: round(
            daily.reduce(
                (sum, row) =>
                    sum + row.collected,
                0
            )
        ),

        outstanding,
        cleaning,
        maintenance,
        feedback,

        averageRating: feedback.length
            ? round(
                feedback.reduce(
                    (sum, review) =>
                        sum + review.rating,
                    0
                ) / feedback.length
            )
            : null,

        daily,

        forecast: makeForecast(
            serializeDates(historicalRows),
            rooms.length
        ),

        note:
            "Reservation counts include all statuses whose stay dates overlap the selected period. " +
            "Reserved occupancy uses retained room-night locks, including pending holds, and current active room inventory. It is not actual historical physical occupancy. " +
            "Invoiced and outstanding totals include only currently confirmed, checked-in or checked-out reservations. " +
            "Invoiced amounts use the original invoice creation date, not approval date. " +
            "Collections use payment dates in Asia/Karachi. " +
            "Outstanding is the current all-date hotel balance for eligible reservations. " +
            "Feedback shows the latest 100 reviews submitted within the selected period. " +
            "Forecast uses the previous 28 days of retained reservation locks and is an estimate."
    };
}