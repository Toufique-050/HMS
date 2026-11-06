import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        location: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        address: {
            type: String,
            default: "",
            maxlength: 2000
        },

        contact: {
            type: String,
            default: "",
            maxlength: 100
        },

        images: [String],

        facilities: [String],

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.models.Hotel ||
    mongoose.model("Hotel", hotelSchema);