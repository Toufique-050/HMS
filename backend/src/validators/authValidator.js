import { z } from "zod";

import {
    HOTEL_SCOPED_ROLES
} from "../config/roles.js";

const name = z.string().trim().min(2).max(80);

const email = z.string()
    .trim()
    .toLowerCase()
    .email()
    .max(254);

export const passwordRule = z.string()
    .min(5, "Password must contain at least 5 characters")
    .max(72)
    .refine(
        value => Buffer.byteLength(value, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes"
    );
const phone = z.string()
    .trim()
    .max(30)
    .regex(/^[+()\d\s-]*$/)
    .optional()
    .default("");

const hotelId = z.string().regex(
    /^[a-f\d]{24}$/i,
    "Invalid hotel ID"
);

export const signupSchema = z.object({
    name,
    email,
    password: passwordRule,
    phone
}).strict();

export const loginSchema = z.object({
    email,

    password: z.string()
      .min(5, "Password must contain at least 5 characters")
        .max(72)
        .refine(
            value => Buffer.byteLength(value, "utf8") <= 72,
            "Password too long"
        )
}).strict();

export const profileSchema = z.object({
    name,
    phone
}).strict();

export const changePasswordSchema = z.object({
    currentPassword: loginSchema.shape.password,
    newPassword: passwordRule
}).strict();

export const createStaffSchema = z.object({
    name,
    email,
    password: passwordRule,
   role: z.enum(HOTEL_SCOPED_ROLES),
    hotelId: hotelId.nullable().optional()
}).strict();

export const updateStaffSchema = z.object({
    name,
    phone,
    role: z.enum(HOTEL_SCOPED_ROLES),
    hotelId,
    isActive: z.boolean()
}).strict();

export const hotelSchema = z.object({
    name: z.string().trim().min(2).max(100),
    location: z.string().trim().min(2).max(100)
}).strict();