import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import publicRoutes from "./routes/publicRoutes.js";
import adminRoutes from "./admin/routes.js";
import authRoutes from "./routes/authRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import hotelsRoutes from "./routes/hotelsRoutes.js";
import imageUploadRoutes from "./routes/imageUploadRoutes.js";

import reservationApprovalRoutes from
    "./routes/reservationApprovalRoutes.js";

import managerRoutes from "./manager/routes.js";
import receptionistRoutes from "./receptionist/routes.js";
import housekeepingRoutes from "./housekeeping/routes.js";
import guestRoutes from "./guest/routes.js";

import errorHandler from "./middleware/errorHandler.js";

export const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(cors({
    origin:
        process.env.FRONTEND_ORIGIN ||
        "http://localhost:5173"
}));

app.use(express.json({
    limit: "20kb"
}));

app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

app.use("/api", rateLimit({
    windowMs: 60000,
    limit: 150,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        message:
            "Too many requests. Try again shortly"
    }
}));

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok"
    });
});

app.use("/api/uploads", imageUploadRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/hotels", hotelsRoutes);

app.use("/api/manager", managerRoutes);
app.use("/api/receptionist", receptionistRoutes);
app.use("/api/housekeeping", housekeepingRoutes);
app.use("/api/guest", guestRoutes);

app.use(
    "/api/reservation-reviews",
    reservationApprovalRoutes
);

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found"
    });
});

app.use(errorHandler);