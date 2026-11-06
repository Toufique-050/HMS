import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        reference: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 2000
        },

        guestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        guestSnapshot: {
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 2000
            },
            email: {
                type: String,
                trim: true,
                maxlength: 2000
            },
            phone: {
                type: String,
                required: true,
                trim: true,
                maxlength: 2000
            }
        },

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

        roomTypeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RoomType",
            required: true
        },

        checkIn: {
            type: Date,
            required: true
        },

        checkOut: {
            type: Date,
            required: true
        },

        guests: {
            type: Number,
            required: true,
            min: 1
        },

        rateSnapshot: {
            type: Number,
            required: true,
            min: 0
        },

        keyReference: {
            type: String,
            trim: true,
            maxlength: 2000
        },

        actualCheckIn: Date,
        actualCheckOut: Date,

        paymentPreference: {
    type: String,
    enum: [
        "not_selected",
        "cash",
        "card_demo",
        "jazzcash_demo",
        "easypaisa_demo"
    ],
    default: "not_selected"
},

paymentPreferenceSelectedAt: Date,

approval: {
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    reviewedAt: Date,

    rejectionReason: {
        type: String,
        trim: true,
        maxlength: 500
    }
},

        status: {
    type: String,
    enum: [
        "pending_approval",
        "confirmed",
        "rejected",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show"
    ],
    default: "confirmed"
}
    },
    { timestamps: true }
);

bookingSchema.index({
    hotelId: 1,
    checkIn: 1,
    checkOut: 1
});

export default mongoose.models.Booking ||
    mongoose.model("Booking", bookingSchema);