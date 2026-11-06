
import { Router } from "express";
import { z } from "zod";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";

import Booking from "../models/Booking.js";
import { trySendBookingEmail } from "../services/bookingEmailService.js";

import {
    assert,
    id,
    parse
} from "../admin/rules.js";

import {
    reviewReservation
} from "../services/reservationApprovalService.js";

const router = Router();

router.use(
    verifyToken,
    allowRoles("Admin")
);

const listInput = z.object({
    status: z.enum([
        "pending_approval",
        "confirmed",
        "rejected"
    ]).default("pending_approval"),

    hotelId: id.optional(),

    page: z.coerce.number()
        .int()
        .min(1)
        .max(10000)
        .default(1),

    limit: z.coerce.number()
        .int()
        .min(1)
        .max(100)
        .default(20)
}).strict();

const reviewInput = z.discriminatedUnion(
    "decision",
    [
        z.object({
            decision: z.literal("approve")
        }).strict(),

        z.object({
            decision: z.literal("reject"),
            rejectionReason: z.string()
                .trim()
                .min(1, "Enter a rejection reason")
                .max(500)
        }).strict()
    ]
);

router.get("/", async (req, res) => {
    const query = parse(listInput, req.query);

    const filter = {
        status: query.status
    };

    if (query.hotelId) {
        filter.hotelId = query.hotelId;
    }

    const [items, total] = await Promise.all([
        Booking.find(filter)
            .select([
                "reference",
                "guestSnapshot",
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
            ].join(" "))
            .populate("hotelId", "name location")
            .populate("roomId", "roomNumber")
            .populate("roomTypeId", "name")
            .populate("approval.reviewedBy", "name role")
            .sort({ createdAt: -1, _id: -1 })
            .skip((query.page - 1) * query.limit)
            .limit(query.limit)
            .lean(),

        Booking.countDocuments(filter)
    ]);

    res.json({
        items,
        total,
        page: query.page,
        pages: Math.max(1, Math.ceil(total / query.limit))
    });
});

router.post("/:id", async (req, res) => {
    const bookingId = parse(id, req.params.id);
    const input = parse(reviewInput, req.body);

    const result = await reviewReservation(
        req.user,
        bookingId,
        input
    );

    if (input.decision === "reject") {
        try {
            await trySendBookingEmail(bookingId, "rejected");
        } catch (error) {
            console.error("Booking rejection email failed:", error.message);
        }
    }

    return res.json(result);
});

router.use((req, res) => {
    res.status(404).json({
        message: "Reservation review endpoint not found"
    });
});

router.use((error, req, res, next) => {
    if (error.code === 11000) {
        return res.status(409).json({
            message: "Reservation data changed. Refresh and try again."
        });
    }

    if (
        /Transaction numbers|replica set|mongos/i.test(
            error.message || ""
        )
    ) {
        return res.status(503).json({
            message: "Reservation approval requires MongoDB Atlas or a replica set."
        });
    }

    next(error);
});

export default router;
