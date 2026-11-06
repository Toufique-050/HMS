import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true,
            unique: true
        },

        taxRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        checkInTime: {
            type: String,
            default: "14:00"
        },

        checkOutTime: {
            type: String,
            default: "12:00"
        },

        cancellationPolicy: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        privacyPolicy: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        invoicePrefix: {
            type: String,
            default: "LS"
        },

        allowOutstandingCheckout: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

export default mongoose.models.Setting ||
    mongoose.model("Setting", settingSchema);