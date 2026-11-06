import mongoose from "mongoose";

const roomNightSchema = new mongoose.Schema(
    {
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        }
    },
    { timestamps: true }
);

// One room can have only one reservation for a given night.
roomNightSchema.index(
    { roomId: 1, date: 1 },
    { unique: true }
);

roomNightSchema.index({ bookingId: 1 });

export default mongoose.models.RoomNight ||
    mongoose.model("RoomNight", roomNightSchema);