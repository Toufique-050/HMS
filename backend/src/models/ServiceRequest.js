import mongoose from "mongoose";

const serviceRequestSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        },

        serviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        // Preserve the price agreed when the request was created.
        priceSnapshot: {
            type: Number,
            required: true,
            min: 0
        },

        scheduledAt: Date,

        notes: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        status: {
            type: String,
            enum: [
                "pending",
                "accepted",
                "completed",
                "cancelled"
            ],
            default: "pending"
        }
    },
    { timestamps: true }
);

export default mongoose.models.ServiceRequest ||
    mongoose.model(
        "ServiceRequest",
        serviceRequestSchema
    );