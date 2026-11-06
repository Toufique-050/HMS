import mongoose from "mongoose";

import {
    ALL_ROLES,
    ROLES,
    HOTEL_SCOPED_ROLES
} from "../config/roles.js";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        role: {
            type: String,
            enum: ALL_ROLES,
            default: ROLES.GUEST,
            required: true
        },

        phone: {
            type: String,
            default: "",
            maxlength: 30
        },

        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            default: null,

            required: function () {
                return HOTEL_SCOPED_ROLES.includes(this.role);
            }
        },

        isActive: {
            type: Boolean,
            default: true
        },

        // Logout/password/access change par increment hoga.
        // Purane JWTs phir accept nahi honge.
        tokenVersion: {
            type: Number,
            default: 0,
            select: false
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("User", userSchema);