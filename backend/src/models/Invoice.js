import mongoose from "mongoose";

const chargeItemSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },

    quantity: {
        type: Number,
        required: true,
        min: 0
    },

    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },

    // Service request ID prevents duplicate billing.
    // Room charges use the value "room".
    sourceId: String
});

const paymentSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0
    },

    method: {
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

    // Idempotency key for payment retries.
    key: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },

    paidAt: Date,

    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
});

const invoiceSchema = new mongoose.Schema(
    {
        number: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 2000
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true
        },

        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true
        },

        chargeItems: [chargeItemSchema],

        taxRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        discount: {
            type: Number,
            min: 0,
            default: 0
        },

        payments: [paymentSchema],

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        tax: {
            type: Number,
            required: true,
            min: 0
        },

        grandTotal: {
            type: Number,
            required: true,
            min: 0
        },

        paid: {
            type: Number,
            required: true,
            min: 0
        },

        balance: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
    type: String,
    enum: ["unpaid", "partially_paid", "paid"],
    default: "unpaid"
},

       receiptEmailStatus: {
    type: String,
    enum: ["pending", "processing", "sent", "failed"],
    default: "pending"
},



receiptEmailSentAt: {
    type: Date,
    default: null
}
    },
    { timestamps: true }
);

export default mongoose.models.Invoice ||
    mongoose.model("Invoice", invoiceSchema);