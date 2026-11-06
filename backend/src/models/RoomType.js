import mongoose from "mongoose";

const roomTypeSchema = new mongoose.Schema(
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

        capacity: {
            type: Number,
            required: true,
            min: 1
        },

        baseRate: {
            type: Number,
            required: true,
            min: 0
        },

        amenities: [String],

        images: [String],

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

roomTypeSchema.index(
    { hotelId: 1, name: 1 },
    { unique: true }
);

export default mongoose.models.RoomType ||
    mongoose.model("RoomType", roomTypeSchema);