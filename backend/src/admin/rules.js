import { z } from "zod";
import ApiError from "../utils/ApiError.js";

export const id = z.string().regex(
    /^[a-f\d]{24}$/i,
    "Choose a valid record"
);

const name = z.string().trim().min(1).max(100);
const note = z.string().trim().max(2000).default("");
const active = z.boolean().default(true);

const cash = z.number()
    .finite()
    .min(0)
    .max(100000000)
    .refine(
        value =>
            Math.abs(value * 100 - Math.round(value * 100)) <
            0.00001,
        "Use at most two decimal places"
    );

const strings = z.array(
    z.string().trim().min(1).max(200)
).max(30).default([]);

const images = z.array(
    z.url().refine(
        value => /^https?:\/\//.test(value),
        "Use HTTP or HTTPS image URLs"
    )
).max(10).default([]);

export const dateOnly = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value => {
        const date = new Date(value + "T00:00:00Z");

        return !isNaN(date) &&
            date.toISOString().slice(0, 10) === value;
    }, "Invalid calendar date");

const dateTime = z.string().refine(
    value => !isNaN(Date.parse(value)),
    "Invalid date/time"
);

const optionalId = id.nullable().default(null);

export const schemas = {
    hotels: z.object({
        name,
        location: name,
        address: note,
        contact: z.string().trim().max(100).default(""),
        images,
        facilities: strings,
        isActive: active
    }).strict(),

    staff: z.object({
        name,
        email: z.email().trim().toLowerCase(),
        phone: z.string().trim().max(30).default(""),
        role: z.enum([
            "Manager",
            "Receptionist",
            "Housekeeping"
        ]),
        hotelId: id,
        isActive: active
    }).strict(),

    guests: z.object({
        name,
        email: z.email().trim().toLowerCase(),
        phone: z.string().trim().max(30).default(""),
        isActive: active
    }).strict(),

    "room-types": z.object({
        hotelId: id,
        name,
        capacity: z.number().int().min(1).max(20),
        baseRate: cash,
        amenities: strings,
        images,
        isActive: active
    }).strict(),

    rooms: z.object({
        hotelId: id,
        roomTypeId: id,
        roomNumber: name,
        floor: z.string().trim().max(20).default(""),
        isActive: active
    }).strict(),

    services: z.object({
        hotelId: id,
        name,
        category: z.enum([
            "food",
            "laundry",
            "transport",
            "wake_up",
            "other"
        ]),
        price: cash,
        isActive: active
    }).strict(),

    bookings: z.object({
        roomId: id,
        guestId: optionalId,
        guestName: name,
        guestEmail: z.union([
            z.email(),
            z.literal("")
        ]).default(""),
        guestPhone: z.string().trim().min(1).max(30),
        checkIn: dateOnly,
        checkOut: dateOnly,
        guests: z.number().int().min(1).max(20)
    }).strict(),

    housekeeping: z.object({
        roomId: id,
        assignedTo: optionalId,
        scheduledAt: dateTime,
        notes: note
    }).strict(),

    maintenance: z.object({
        roomId: id,
        assignedTo: optionalId,
        issue: z.string().trim().min(1).max(2000),
        priority: z.enum([
            "low",
            "medium",
            "high",
            "urgent"
        ])
    }).strict(),

    "service-requests": z.object({
        bookingId: id,
        serviceId: id,
        quantity: z.number().int().min(1).max(100),
        scheduledAt: dateTime,
        notes: note
    }).strict(),

    settings: z.object({
        hotelId: id,
        taxRate: z.number().min(0).max(100),
        checkInTime: z.string().regex(
            /^([01]\d|2[0-3]):[0-5]\d$/
        ),
        checkOutTime: z.string().regex(
            /^([01]\d|2[0-3]):[0-5]\d$/
        ),
        cancellationPolicy: note,
        privacyPolicy: note,
        invoicePrefix: z.string()
            .trim()
            .regex(/^[A-Z0-9-]{1,12}$/),
        allowOutstandingCheckout: z.boolean()
    }).strict()
};

export const passwordSchema = z.string()
    .min(12)
    .max(72)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/)
    .refine(
        value => Buffer.byteLength(value, "utf8") <= 72,
        "Password exceeds bcrypt's 72-byte limit"
    );

export const actions = {
    "check-in": z.object({
        keyReference: z.string().trim().min(1).max(100)
    }).strict(),

    extend: z.object({
        checkOut: dateOnly
    }).strict(),

    "change-room": z.object({
        roomId: id
    }).strict(),

    "check-out": z.object({}).strict(),

    cancel: z.object({}).strict(),

    "no-show": z.object({}).strict(),

    assign: z.object({
        assignedTo: id
    }).strict(),

    status: z.object({
        status: z.string().max(30),
        resolution: note
    }).strict(),

    readiness: z.object({
        housekeepingStatus: z.enum([
            "clean",
            "dirty",
            "cleaning"
        ]),
        maintenanceStatus: z.enum([
            "operational",
            "out_of_service"
        ])
    }).strict(),

    payment: z.object({
        amount: cash.refine(value => value > 0),
        method: z.enum(["cash", "bank", "card"]),
        reference: z.string().trim().max(100).default(""),
        key: z.uuid()
    }).strict(),

    discount: z.object({
        discount: cash
    }).strict(),

    email: z.object({}).strict(),

    read: z.object({}).strict()
};

export function parse(schema, value) {
    if (!schema) {
        throw new ApiError(
            405,
            "This operation is not supported"
        );
    }

    const result = schema.safeParse(value);

    if (!result.success) {
        const message = result.error.issues
            .map(issue =>
                `${issue.path.join(".")}: ${issue.message}`
            )
            .join("; ");

        throw new ApiError(400, message);
    }

    return result.data;
}

export function assert(condition, message, status = 400) {
    if (!condition) {
        throw new ApiError(status, message);
    }
}

export const round = value =>
    Math.round((value + Number.EPSILON) * 100) / 100;

export function nights(checkIn, checkOut) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);

    const count = (end - start) / 86400000;

    assert(
        Number.isInteger(count) &&
        count >= 1 &&
        count <= 365,
        "Stay must be between 1 and 365 nights"
    );

    return Array.from(
        { length: count },
        (_, index) =>
            new Date(start.getTime() + index * 86400000)
    );
}

export function totals(invoice) {
    const subtotal = round(
        invoice.chargeItems.reduce(
            (sum, item) =>
                sum + item.quantity * item.unitPrice,
            0
        )
    );

    assert(
        invoice.discount <= subtotal,
        "Discount exceeds subtotal"
    );

    // Tax applies to subtotal; discount is deducted after tax.
    const tax = round(subtotal * invoice.taxRate / 100);

    const grandTotal = round(
        subtotal + tax - invoice.discount
    );

    const paid = round(
        invoice.payments.reduce(
            (sum, payment) => sum + payment.amount,
            0
        )
    );

    assert(
        paid <= grandTotal,
        "Total cannot be reduced below recorded payments"
    );

    return {
        subtotal,
        tax,
        grandTotal,
        paid,
        balance: round(grandTotal - paid),
        status: paid === grandTotal
            ? "paid"
            : paid > 0
                ? "partially_paid"
                : "unpaid"
    };
}

export function today() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}