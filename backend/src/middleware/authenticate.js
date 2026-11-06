import mongoose from "mongoose";

import User from "../models/User.js";
import { readToken } from "../utils/tokens.js";

export default async function verifyToken(req, res, next) {
    const match = req.get("Authorization")
        ?.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
        return res.status(401).json({
            message: "Please log in"
        });
    }

    let decoded;

    try {
        decoded = readToken(match[1]);
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }

    if (
        typeof decoded !== "object" ||
        !mongoose.isObjectIdOrHexString(decoded.sub) ||
        !Number.isInteger(decoded.tokenVersion)
    ) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }

    const user = await User.findById(decoded.sub)
        .select("+tokenVersion");

    if (
        !user ||
        !user.isActive ||
        user.tokenVersion !== decoded.tokenVersion
    ) {
        return res.status(401).json({
            message: "Session ended. Log in again"
        });
    }

    // Current database role is authoritative.
    req.user = user;

    next();
}