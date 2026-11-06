import {
    Booking,
    Room,
    RoomNight,
    Invoice,
    Feedback,
    HousekeepingTask,
    MaintenanceRequest,
    Hotel,
    User
} from "./models.js";



import {
    parse,
    id,
    dateOnly,
    nights,
    round,
    today
} from "./rules.js";

const financialBookingStatuses = [
    "confirmed",
    "checked_in",
    "checked_out"
];

function karachiDate(value) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date(value));
}

export async function report(query) {
    const endText = query.to || today();

    parse(dateOnly, endText);

    const startText = query.from ||
        new Date(
            Date.parse(endText) - 29 * 86400000
        ).toISOString().slice(0, 10);

    parse(dateOnly, startText);

    const start = new Date(startText);

    const endExclusive = new Date(
        Date.parse(endText) + 86400000
    );

    // nights() validates the range and returns UTC date labels.
    const labels = nights(
        start,
        endExclusive
    ).map(date =>
        date.toISOString().slice(0, 10)
    );

    // Financial timestamps use the hotel's local calendar.
    const financialStart = new Date(
        `${startText}T00:00:00+05:00`
    );

    const financialEnd = new Date(
        `${endExclusive.toISOString().slice(0, 10)}T00:00:00+05:00`
    );

    const filter = query.hotelId
        ? {
            hotelId: parse(id, query.hotelId)
        }
        : {};

    const rooms = await Room.find({
        ...filter,
        isActive: true
    })
        .select("_id")
        .lean();

    const roomIds = rooms.map(room => room._id);

    const bookingFilter = {
        ...filter,
        checkIn: {
            $lt: endExclusive
        },
        checkOut: {
            $gt: start
        }
    };

    const [
        bookings,
        invoiceRows,
        nightRows,
        feedbackBookingIds,
        cleaning,
        maintenance,
        hotels,
        staff,
        outstandingInvoices
    ] = await Promise.all([
        Booking.find(bookingFilter)
            .select("status")
            .lean(),

        Invoice.find({
            ...filter,

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
            .populate("bookingId", "status")
            .lean(),

        RoomNight.find({
            roomId: {
                $in: roomIds
            },
            date: {
                $gte: start,
                $lt: endExclusive
            }
        })
            .select("date")
            .lean(),

        Booking.distinct("_id", filter),

        HousekeepingTask.countDocuments({
            ...filter,
            status: {
                $ne: "completed"
            }
        }),

        MaintenanceRequest.countDocuments({
            ...filter,
            status: {
                $ne: "resolved"
            }
        }),

        Hotel.countDocuments(
            query.hotelId
                ? {
                    _id: query.hotelId
                }
                : {}
        ),

        User.countDocuments({
            ...filter,
            role: {
                $ne: "Guest"
            },
            isActive: true
        }),

        Invoice.find(filter)
            .select("balance bookingId")
            .populate("bookingId", "status")
            .lean()
    ]);

    // Only approved/active/completed reservations contribute
    // to these invoiced and outstanding financial metrics.
    const invoices = invoiceRows.filter(invoice =>
        financialBookingStatuses.includes(
            invoice.bookingId?.status
        )
    );

    const feedback = await Feedback.find({
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

    const reservationCounts = new Map();
    const collectionAmounts = new Map();

    for (const row of nightRows) {
        const label = new Date(row.date)
            .toISOString()
            .slice(0, 10);

        reservationCounts.set(
            label,
            (reservationCounts.get(label) || 0) + 1
        );
    }

    for (const invoice of invoices) {
        for (const payment of invoice.payments || []) {
            if (!payment.paidAt) continue;

            const paidAt = new Date(payment.paidAt);

            if (
                paidAt < financialStart ||
                paidAt >= financialEnd
            ) {
                continue;
            }

            const label = karachiDate(paidAt);

            collectionAmounts.set(
                label,

                (collectionAmounts.get(label) || 0) +
                Number(payment.amount || 0)
            );
        }
    }

    const daily = labels.map(label => {
        const reservedNights =
            reservationCounts.get(label) || 0;

        return {
            date: label,
            reservedNights,

            occupancyPercent: rooms.length
                ? round(
                    100 * reservedNights / rooms.length
                )
                : 0,

            collected: round(
                collectionAmounts.get(label) || 0
            )
        };
    });

    const historicalEnd = new Date(today());

    const historicalStart = new Date(
        historicalEnd.getTime() - 28 * 86400000
    );

    const historicalNights = await RoomNight.find({
        roomId: {
            $in: roomIds
        },

        date: {
            $gte: historicalStart,
            $lt: historicalEnd
        }
    })
        .select("date")
        .lean();

    const observedDays = new Set(
        historicalNights.map(row =>
            new Date(row.date)
                .toISOString()
                .slice(0, 10)
        )
    ).size;

    let forecast = null;

    if (observedDays >= 7 && rooms.length > 0) {
        const ratio =
            historicalNights.length /
            (28 * rooms.length);

        forecast = {
            method:
                "Previous 28 calendar days: retained reserved room nights divided by 28 × current active room inventory.",

            occupancyPercent: round(
                100 * ratio
            ),

            next7RoomNights: round(
                historicalNights.length / 28 * 7
            ),

            suggestion: ratio >= 0.8
                ? "Review rates upward. Manager approval and a manual rate update are required."
                : "Review promotions and service quality before changing rates. No automatic price change is made."
        };
    }

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
        outstandingInvoices
            .filter(invoice =>
                financialBookingStatuses.includes(
                    invoice.bookingId?.status
                )
            )
            .reduce(
                (sum, invoice) =>
                    sum + invoice.balance,
                0
            )
    );

    return {
        from: startText,
        to: endText,

        hotels,
        staff,
        rooms: rooms.length,

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

        reservedNights: nightRows.length,

        occupancyPercent: rooms.length
            ? round(
                100 * nightRows.length /
                (labels.length * rooms.length)
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
        forecast,

        note:
            "Reservation counts include all statuses whose stay dates overlap the selected period. " +
            "Reserved occupancy uses retained room-night locks, including pending holds, and current active inventory; it is not actual historical physical occupancy. " +
            "Invoiced and outstanding totals include only currently confirmed, checked-in or checked-out reservations. " +
            "Invoiced amounts use the original invoice creation date, not approval date. " +
            "Collections use payment timestamps in Asia/Karachi. " +
            "Outstanding is the current all-date balance for eligible reservations. " +
            "Feedback shows the latest 100 reviews submitted within the selected period. " +
            "Forecast uses the previous 28 days of retained reservation locks and is an estimate."
    };
}

export function csv(rows) {
    const safe = value => {
        let text = String(value ?? "");

        if (/^[=+@\-\t\r]/.test(text)) {
            text = "'" + text;
        }

        return (
            '"' +
            text.replaceAll('"', '""') +
            '"'
        );
    };

    const headings = Object.keys(
        rows[0] || {
            date: "",
            reservedNights: "",
            occupancyPercent: "",
            collected: ""
        }
    );

    const lines = [
        headings,

        ...rows.map(row =>
            headings.map(key => row[key])
        )
    ];

    return (
        "\uFEFF" +
        lines.map(row =>
            row.map(safe).join(",")
        ).join("\r\n")
    );
}