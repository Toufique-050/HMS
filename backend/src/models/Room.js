import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true
        },

        roomTypeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomType",
            required: true
        },

        roomNumber: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        floor: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        occupancyStatus: {
            type: String,
            enum: ["vacant", "occupied"],
            default: "vacant"
        },

        housekeepingStatus: {
            type: String,
            enum: [
                "clean",
                "dirty",
                "cleaning"
            ],
            default: "clean"
        },

        maintenanceStatus: {
            type: String,
            enum: [
                "operational",
                "out_of_service"
            ],
            default: "operational"
        },

        // Used by transaction workflows to serialize room updates.
        bookingVersion: {
            type: Number,
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

roomSchema.index(
    { hotelId: 1, roomNumber: 1 },
    { unique: true }
);

export default mongoose.models.Room ||
    mongoose.model("Room", roomSchema);