import { Router } from "express";
import { z } from "zod";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";

import Booking from "../models/Booking.js";
import Invoice from "../models/Invoice.js";
import Service from "../models/Service.js";
import ServiceRequest from "../models/ServiceRequest.js";
import MaintenanceRequest from "../models/MaintenanceRequest.js";
import Feedback from "../models/Feedback.js";
import Notification from "../models/Notification.js";
import Setting from "../models/Setting.js";
import {
    trySendBookingEmail,
    trySendAdminNewBookingEmail
} from "../services/bookingEmailService.js";

import { assert, parse } from "../admin/rules.js";

import {
    recordId,
    listQuery,
    serviceRequestInput,
    maintenanceRequestInput,
    feedbackInput,
    emptyInput
} from "./validators.js";

import {
    cancelBooking,
    requestService,
    reportMaintenance,
    submitFeedback
} from "./service.js";

const router = Router();

const APPROVAL_WINDOW_MS = 24 * 60 * 60 * 1000;

router.use(verifyToken, allowRoles("Guest"));

let initialized;

router.use(async (req, res, next) => {
    if (!initialized) {
        initialized = Promise.all([
            Feedback.init(),
            ServiceRequest.init(),
            MaintenanceRequest.init(),
            Notification.init()
        ]).catch(error => {
            initialized = null;
            throw error;
        });
    }

    await initialized;
    next();
});

const bookingFields = [
    "reference",
    "hotelId",
    "roomId",
    "roomTypeId",
    "checkIn",
    "checkOut",
    "guests",
    "rateSnapshot",
    "status",
    "paymentPreference",
    "paymentPreferenceSelectedAt",
    "approval",
    "createdAt"
].join(" ");

const invoiceFields = [
    "number",
    "bookingId",
    "hotelId",
    "chargeItems",
    "taxRate",
    "discount",
    "subtotal",
    "tax",
    "grandTotal",
    "paid",
    "balance",
    "status",
    "createdAt"
].join(" ");

const bookingQuery = listQuery.extend({
    status: z.enum([
        "pending_approval",
        "confirmed",
        "rejected",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show"
    ]).optional()
}).strict();

const paymentInput = z.object({
    paymentPreference: z.enum([
        "cash",
        "card_demo",
        "jazzcash_demo",
        "easypaisa_demo"
    ])
}).strict();

function withApprovalWindow(booking) {
    if (!booking) return booking;

    const created = new Date(booking.createdAt).getTime();

    const expiresAt = Number.isFinite(created)
        ? new Date(created + APPROVAL_WINDOW_MS)
        : null;

    const pending =
        booking.status === "pending_approval";

    return {
        ...booking,

        approvalExpiresAt: pending && expiresAt
            ? expiresAt.toISOString()
            : null,

        approvalExpired: pending && (
            !expiresAt ||
            Date.now() >= expiresAt.getTime()
        )
    };
}

function populateBooking(query) {
    return query
        .populate("hotelId", "name location contact")
        .populate("roomId", "roomNumber")
        .populate("roomTypeId", "name");
}

async function ownBooking(req, key) {
    const booking = await Booking.findOne({
        _id: key,
        guestId: req.user._id
    }).select(bookingFields);

    assert(booking, "Booking not found", 404);

    return booking;
}

async function bookingIds(req) {
    return Booking.find({
        guestId: req.user._id
    }).distinct("_id");
}

async function paginate(
    Model,
    filter,
    query,
    select,
    populates = []
) {
    let request = Model.find(filter)
        .select(select)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit);

    for (const [path, fields] of populates) {
        request = request.populate(path, fields);
    }

    const [items, total] = await Promise.all([
        request.lean(),
        Model.countDocuments(filter)
    ]);

    return {
        items,
        total,
        page: query.page,
        pages: Math.max(
            1,
            Math.ceil(total / query.limit)
        )
    };
}

router.get("/dashboard", async (req, res) => {
    const guestFilter = {
        guestId: req.user._id
    };

    const [
        confirmed,
        checkedIn,
        completed,
        pendingApproval,
        rejected,
        unread,
        stays
    ] = await Promise.all([
        Booking.countDocuments({
            ...guestFilter,
            status: "confirmed"
        }),

        Booking.countDocuments({
            ...guestFilter,
            status: "checked_in"
        }),

        Booking.countDocuments({
            ...guestFilter,
            status: "checked_out"
        }),

        Booking.countDocuments({
            ...guestFilter,
            status: "pending_approval"
        }),

        Booking.countDocuments({
            ...guestFilter,
            status: "rejected"
        }),

        Notification.countDocuments({
            recipientId: req.user._id,
            isRead: false
        }),

        populateBooking(
            Booking.find({
                ...guestFilter,
                status: {
                    $in: [
                        "pending_approval",
                        "confirmed",
                        "checked_in"
                    ]
                }
            })
                .select(bookingFields)
                .sort({ checkIn: 1 })
                .limit(5)
        ).lean()
    ]);

    res.json({
        stats: {
            confirmed,
            checkedIn,
            completed,
            pendingApproval,
            rejected,
            unread
        },

        stays: stays.map(withApprovalWindow)
    });
});

router.get("/bookings", async (req, res) => {
    const query = parse(bookingQuery, req.query);

    const filter = {
        guestId: req.user._id
    };

    if (query.status) {
        filter.status = query.status;
    }

    const result = await paginate(
        Booking,
        filter,
        query,
        bookingFields,
        [
            ["hotelId", "name location"],
            ["roomId", "roomNumber"],
            ["roomTypeId", "name"]
        ]
    );

    res.json({
        ...result,
        items: result.items.map(withApprovalWindow)
    });
});

router.get("/bookings/:id", async (req, res) => {
    const key = parse(recordId, req.params.id);
    const booking = await ownBooking(req, key);

    const [item, feedback, settings] = await Promise.all([
        populateBooking(
            Booking.findOne({
                _id: booking._id,
                guestId: req.user._id
            }).select(bookingFields)
        ).lean(),

        Feedback.findOne({
            bookingId: booking._id,
            guestId: req.user._id
        })
            .select("rating comment createdAt")
            .lean(),

        Setting.findOne({
            hotelId: booking.hotelId
        })
            .select(
                "checkInTime checkOutTime cancellationPolicy"
            )
            .lean()
    ]);

    res.json({
        item: withApprovalWindow(item),
        feedback,
        settings
    });
});

router.patch(
    "/bookings/:id/payment-preference",
    async (req, res) => {
        const key = parse(recordId, req.params.id);
        const data = parse(paymentInput, req.body);

        const now = new Date();

        // Atomic filter prevents updates after the expiry cutoff.
        const item = await Booking.findOneAndUpdate(
            {
                _id: key,
                guestId: req.user._id,
                status: "pending_approval",

                createdAt: {
                    $gt: new Date(
                        now.getTime() - APPROVAL_WINDOW_MS
                    )
                }
            },
            {
                $set: {
                    paymentPreference: data.paymentPreference,
                    paymentPreferenceSelectedAt: now
                }
            },
            {
                new: true,
                runValidators: true
            }
        )
            .select(bookingFields)
            .lean();

        if (!item) {
            const booking = await Booking.findOne({
                _id: key,
                guestId: req.user._id
            })
                .select("status createdAt")
                .lean();

            assert(
                booking,
                "Booking not found",
                404
            );

            assert(
                booking.status === "pending_approval",
                "Payment option can only be changed while awaiting approval.",
                409
            );

            assert(
                false,
                "The 24-hour approval window has expired. Cancel this request or wait for automatic cancellation, then submit a new reservation.",
                409
            );
        }

        res.json({
            message:
                "Payment option saved. Your reservation is awaiting hotel approval.",

            item: withApprovalWindow(item)
        });
    }
);

router.post("/bookings/:id/cancel", async (req, res) => {
    const key = parse(
        recordId,
        req.params.id
    );

    parse(
        emptyInput,
        req.body
    );

    // Complete the cancellation first.
    const result = await cancelBooking(
        req.user,
        key
    );

    // A repeated cancellation should not send another email.
    if (
        result.message !==
        "This reservation is already cancelled"
    ) {
        await trySendBookingEmail(
            key,
            "cancelled"
        );
    }

    return res.json(result);
});

router.get("/options", async (req, res) => {
    const bookings = await Booking.find({
        guestId: req.user._id,
        status: "checked_in"
    })
        .select("reference hotelId roomId checkOut")
        .populate("hotelId", "name")
        .populate("roomId", "roomNumber")
        .lean();

    const hotelIds = bookings
        .map(booking => booking.hotelId?._id)
        .filter(Boolean);

    const services = await Service.find({
        hotelId: { $in: hotelIds },
        isActive: true
    })
        .select("hotelId name category price")
        .sort({ name: 1 })
        .lean();

    res.json({ bookings, services });
});

router.get("/services", async (req, res) => {
    const query = parse(listQuery, req.query);
    const ids = await bookingIds(req);

    res.json(await paginate(
        ServiceRequest,
        { bookingId: { $in: ids } },
        query,
        "bookingId serviceId quantity priceSnapshot scheduledAt notes status createdAt",
        [
            ["bookingId", "reference"],
            ["serviceId", "name category"]
        ]
    ));
});

router.post("/services", async (req, res) => {
    const data = parse(serviceRequestInput, req.body);

    res.status(201).json({
        item: await requestService(req.user, data)
    });
});

router.get("/maintenance", async (req, res) => {
    const query = parse(listQuery, req.query);
    const ids = await bookingIds(req);

    res.json(await paginate(
        MaintenanceRequest,
        {
            bookingId: { $in: ids },
            reportedBy: req.user._id
        },
        query,
        "bookingId issue priority status resolution createdAt",
        [["bookingId", "reference"]]
    ));
});

router.post("/maintenance", async (req, res) => {
    const data = parse(
        maintenanceRequestInput,
        req.body
    );

    res.status(201).json({
        item: await reportMaintenance(req.user, data)
    });
});

router.post("/feedback", async (req, res) => {
    const data = parse(feedbackInput, req.body);

    res.status(201).json({
        item: await submitFeedback(req.user, data)
    });
});

router.get("/invoices", async (req, res) => {
    const query = parse(listQuery, req.query);
    const ids = await bookingIds(req);

    res.json(await paginate(
        Invoice,
        { bookingId: { $in: ids } },
        query,
        invoiceFields,
        [[
            "bookingId",
            "reference checkIn checkOut status paymentPreference"
        ]]
    ));
});

router.get("/invoices/:id", async (req, res) => {
    const key = parse(recordId, req.params.id);

    const invoice = await Invoice.findById(key)
        .select(invoiceFields)
        .lean();

    assert(invoice, "Invoice not found", 404);

    await ownBooking(req, invoice.bookingId);

    const item = await Invoice.findById(invoice._id)
        .select(invoiceFields)
        .populate("hotelId", "name address contact")
        .populate(
            "bookingId",
            "reference checkIn checkOut guestSnapshot status paymentPreference"
        )
        .lean();

    res.json({ item });
});

router.get("/notifications", async (req, res) => {
    const query = parse(listQuery, req.query);

    res.json(await paginate(
        Notification,
        { recipientId: req.user._id },
        query,
        "type message reference isRead createdAt"
    ));
});

router.post(
    "/notifications/:id/read",
    async (req, res) => {
        const key = parse(recordId, req.params.id);

        parse(emptyInput, req.body);

        const item = await Notification.findOneAndUpdate(
            {
                _id: key,
                recipientId: req.user._id
            },
            {
                $set: {
                    isRead: true
                }
            },
            {
                new: true
            }
        )
            .select("_id isRead")
            .lean();

        assert(
            item,
            "Notification not found",
            404
        );

        res.json({ item });
    }
);

router.use((req, res) => {
    res.status(404).json({
        message: "Guest endpoint not found"
    });
});

router.use((error, req, res, next) => {
    if (error.code === 11000) {
        return res.status(409).json({
            message:
                "This record already exists. Refresh and check again."
        });
    }

    if (
        /Transaction numbers|replica set|mongos/i.test(
            error.message || ""
        )
    ) {
        return res.status(503).json({
            message:
                "Guest updates require MongoDB Atlas or a replica set."
        });
    }

    next(error);
});

export default router;