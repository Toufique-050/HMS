import "dotenv/config";

import { createServer } from "node:http";
import mongoose from "mongoose";

import connectDatabase from "./config/database.js";
import { checkJwtSecret } from "./utils/tokens.js";

import User from "./models/User.js";
import { app } from "./app.js";

import {
    startSocketServer
} from "./realtime/socketServer.js";

import {
    startReservationExpiryJob
} from "./jobs/reservationExpiryJob.js";

let server;
let io;
let stopExpiryJob;
let shuttingDown = false;

async function shutdown() {
    if (shuttingDown) return;

    shuttingDown = true;

    // Force termination if connections cannot drain.
    const shutdownTimer = setTimeout(() => {
        console.error("Server shutdown timed out");
        process.exit(1);
    }, 15_000);

    shutdownTimer.unref();

    try {
        if (stopExpiryJob) {
            await stopExpiryJob();
        }

        if (server) {
            await new Promise((resolve, reject) => {
                // Stop accepting new HTTP connections.
                server.close(error => {
                    if (
                        error &&
                        error.code !== "ERR_SERVER_NOT_RUNNING"
                    ) {
                        reject(error);
                        return;
                    }

                    resolve();
                });

                // Disconnect sockets so HTTP shutdown can finish.
                io?.disconnectSockets(true);
                io?.close();

                server.closeIdleConnections?.();
            });
        }

        await mongoose.disconnect();
    } catch {
        console.error("Server shutdown failed");
        process.exitCode = 1;
    } finally {
        clearTimeout(shutdownTimer);
    }
}

try {
    checkJwtSecret();

    await connectDatabase();
    await User.init();

    const port = Number(process.env.PORT || 5000);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error("PORT must be between 1 and 65535");
    }

    server = createServer(app);

    io = startSocketServer(server);

    server.on("error", error => {
        console.error(
            "HTTP server failed:",
            error.code || "UNKNOWN"
        );

        process.exitCode = 1;
        void shutdown();
    });

    server.listen(port, () => {
        console.log(`API running on port ${port}`);
        console.log("Real-time server enabled");

        try {
            stopExpiryJob = startReservationExpiryJob();
        } catch {
            console.error(
                "Reservation expiry job could not start"
            );

            process.exitCode = 1;
            void shutdown();
        }
    });

    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.on(signal, () => {
            void shutdown();
        });
    }
} catch (error) {
    console.error("Startup failed:", error.message);

    process.exitCode = 1;
    await shutdown();
}