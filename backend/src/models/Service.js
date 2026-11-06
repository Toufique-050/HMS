import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        category: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export default mongoose.models.Service ||
    mongoose.model("Service", serviceSchema);