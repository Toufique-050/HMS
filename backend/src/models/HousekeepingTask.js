import mongoose from "mongoose";

const housekeepingTaskSchema = new mongoose.Schema(
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

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        scheduledAt: {
            type: Date,
            required: true
        },

        notes: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        startedAt: Date,
        completedAt: Date,
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        completionNotes: { type: String, trim: true, maxlength: 2000, default: "" },
        checklist: {
            linen: { type: Boolean, default: false },
            bathroom: { type: Boolean, default: false },
            surfaces: { type: Boolean, default: false },
            floor: { type: Boolean, default: false },
            bins: { type: Boolean, default: false },
            supplies: { type: Boolean, default: false }
        },

        status: {
            type: String,
            enum: [
                "pending",
                "in_progress",
                "completed"
            ],
            default: "pending"
        }
    },
    { timestamps: true }
);

housekeepingTaskSchema.index({ hotelId: 1, assignedTo: 1, status: 1, scheduledAt: 1 });

export default mongoose.models.HousekeepingTask ||
    mongoose.model(
        "HousekeepingTask",
        housekeepingTaskSchema
    );