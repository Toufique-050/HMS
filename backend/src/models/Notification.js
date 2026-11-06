import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        reference: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        isRead: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

notificationSchema.index({
    recipientId: 1,
    createdAt: -1
});

export default mongoose.models.Notification ||
    mongoose.model(
        "Notification",
        notificationSchema
    );