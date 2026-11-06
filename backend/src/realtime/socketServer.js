import { Server } from "socket.io";
import mongoose from "mongoose";

import User from "../models/User.js";
import { readToken } from "../utils/tokens.js";

let io;

const staffRoles = new Set([
    "Admin",
    "Manager",
    "Receptionist",
    "Housekeeping"
]);

async function authenticatedUser(token) {
    if (typeof token !== "string" || token.length > 4096) {
        throw new Error("Please log in");
    }

    const decoded = readToken(token);

    if (
        typeof decoded !== "object" ||
        !mongoose.isObjectIdOrHexString(decoded.sub) ||
        !Number.isInteger(decoded.tokenVersion)
    ) {
        throw new Error("Invalid session");
    }

    const user = await User.findById(decoded.sub)
        .select("_id role hotelId isActive +tokenVersion")
        .lean();

    if (
        !user ||
        !user.isActive ||
        user.tokenVersion !== decoded.tokenVersion
    ) {
        throw new Error("Session ended");
    }

    if (!staffRoles.has(user.role)) {
        throw new Error("Staff access required");
    }

    if (
        user.role !== "Admin" &&
        !mongoose.isObjectIdOrHexString(user.hotelId)
    ) {
        throw new Error("No assigned hotel");
    }

    return { user, expiresAt: decoded.exp * 1000 };
}

export function startSocketServer(httpServer) {
    if (io) {
        throw new Error("Socket server already started");
    }

    const frontendOrigin =
        process.env.FRONTEND_ORIGIN ||
        "http://localhost:5173";

    io = new Server(httpServer, {
        cors: {
            origin: frontendOrigin,
            methods: ["GET", "POST"]
        },

        // Enforce browser origin for WebSocket connections too.
        allowRequest(req, callback) {
            const origin = req.headers.origin;

            callback(
                null,
                !origin || origin === frontendOrigin
            );
        },

        maxHttpBufferSize: 10_000
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            const { user, expiresAt } =
                await authenticatedUser(token);

            socket.data.token = token;
            socket.data.userId = String(user._id);
            socket.data.expiresAt = expiresAt;

            next();
        } catch {
            next(new Error(
                "Socket access denied. Please log in again."
            ));
        }
    });

    io.on("connection", socket => {
        const remaining = Math.max(
            0,
            socket.data.expiresAt - Date.now()
        );

        const expiryTimer = setTimeout(() => {
            socket.disconnect(true);
        }, remaining);

        expiryTimer.unref?.();

        socket.on("disconnect", () => {
            clearTimeout(expiryTimer);
        });

        // Clients cannot choose a hotel or broadcast updates.
        socket.emit("realtime:ready", {
            connected: true
        });
    });

    return io;
}

/**
 * Call only AFTER a successful database commit.
 * Sends a refresh signal without guest or invoice details.
 */
export async function publishHotelUpdate(hotelId) {
    if (!io) return;

    if (!mongoose.isObjectIdOrHexString(hotelId)) {
        throw new Error("A valid hotelId is required");
    }

    const targetHotel = String(hotelId);
    const sockets = [...io.of("/").sockets.values()];

    await Promise.allSettled(
        sockets.map(async socket => {
            let user;

            try {
                // Recheck activity, role, token and hotel
                // before every update.
                ({ user } = await authenticatedUser(
                    socket.data.token
                ));
            } catch {
                socket.disconnect(true);
                return;
            }

            const permitted =
                user.role === "Admin" ||
                String(user.hotelId) === targetHotel;

            if (socket.connected && permitted) {
                socket.emit("hotel:updated", {
                    hotelId: targetHotel,
                    updatedAt: new Date().toISOString()
                });
            }
        })
    );
}