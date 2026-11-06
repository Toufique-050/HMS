import mongoose from "mongoose";

const maintenanceRequestSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true
        },

        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking"
        },

        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        issue: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        workNotes: { type: String, trim: true, maxlength: 2000, default: "" },
        workUpdatedAt: Date,

        resolution: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        priority: {
            type: String,
            enum: [
                "low",
                "medium",
                "high",
                "urgent"
            ],
            default: "medium"
        },

        status: {
            type: String,
            enum: [
                "open",
                "in_progress",
                "resolved"
            ],
            default: "open"
        }
    },
    { timestamps: true }
);

maintenanceRequestSchema.index({ hotelId: 1, assignedTo: 1, status: 1 });
maintenanceRequestSchema.index({ hotelId: 1, reportedBy: 1, createdAt: -1 });

export default mongoose.models.MaintenanceRequest ||
    mongoose.model(
        "MaintenanceRequest",
        maintenanceRequestSchema
    );