import { z } from "zod";

export const recordId = z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid record ID");

export const listQuery = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10)
}).strict();

export const bookingListQuery = listQuery.extend({
    status: z.enum([
        "",
        "confirmed",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show"
    ]).default("")
});

export const serviceRequestInput = z.object({
    bookingId: recordId,
    serviceId: recordId,
    quantity: z.number().int().min(1).max(100),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().trim().max(2000).default("")
}).strict();

export const maintenanceRequestInput = z.object({
    bookingId: recordId,
    issue: z.string().trim().min(5).max(2000),
    priority: z.enum([
        "low",
        "medium",
        "high",
        "urgent"
    ]).default("medium")
}).strict();

export const feedbackInput = z.object({
    bookingId: recordId,
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).default("")
}).strict();

export const emptyInput = z.object({}).strict();