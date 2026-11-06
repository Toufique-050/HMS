import { z } from "zod";
import { CHECKLIST } from "./policy.js";
export const recordId = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid record");
export const pageQuery = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(100).default(""),
    status: z.string().max(30).default(""),
    view: z.enum(["all", "assigned", "reported"]).default("all"),
    unread: z.enum(["true", "false"]).optional()
}).strict();
export const cleaningUpdate = z.discriminatedUnion("status", [
    z.object({ status: z.literal("in_progress") }).strict(),
    z.object({ status: z.literal("completed"),
        checklist: z.object(Object.fromEntries(CHECKLIST.map(([key]) => [key, z.literal(true)]))).strict(),
        completionNotes: z.string().trim().max(2000).default("")
    }).strict()
]);
export const reportIssue = z.object({
    roomId: recordId,
    issue: z.string().trim().min(1).max(2000),
    priority: z.enum(["low", "medium", "high", "urgent"])
}).strict();
export const issueUpdate = z.discriminatedUnion("action", [
    z.object({ action: z.literal("start") }).strict(),
    z.object({ action: z.literal("work-note"), workNotes: z.string().trim().min(1).max(2000) }).strict()
]);
