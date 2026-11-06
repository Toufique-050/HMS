import bcrypt from "bcrypt";

import User from "../models/User.js";
import Hotel from "../models/Hotel.js";

import {
    ROLES,
    HOTEL_SCOPED_ROLES
} from "../config/roles.js";

import { publicUser } from "../utils/tokens.js";
import ApiError from "../utils/ApiError.js";

async function resolveHotel(role, hotelId) {
    if (role === ROLES.ADMIN) {
        if (hotelId) {
            throw new ApiError(
                400,
                "Admin does not require a hotel assignment"
            );
        }

        return null;
    }

    if (
        !hotelId ||
        !await Hotel.exists({
            _id: hotelId,
            isActive: true
        })
    ) {
        throw new ApiError(
            400,
            "Select an existing active hotel"
        );
    }

    return hotelId;
}

export async function createStaff(req, res) {
    const { name, email, password, phone, role } = req.body;

    const hotelId = await resolveHotel(
        role,
        req.body.hotelId
    );

    const user = await User.create({
        name,
        email,
        phone,
        role,
        hotelId,
        passwordHash: await bcrypt.hash(password, 12)
    });

    res.status(201).json({
        message: "Staff account created",
        user: publicUser(user)
    });
}

export async function listStaff(req, res) {
    const page = Math.max(
        1,
        Math.min(10000, parseInt(req.query.page, 10) || 1)
    );

    const filter = {
        role: { $ne: ROLES.GUEST }
    };

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * 20)
            .limit(20),

        User.countDocuments(filter)
    ]);

    res.json({
        users: users.map(publicUser),
        page,
        pages: Math.max(1, Math.ceil(total / 20))
    });
}

export async function updateStaff(req, res) {
    const hotelId = await resolveHotel(
        req.body.role,
        req.body.hotelId
    );

    const user = await User.findOneAndUpdate(
        {
            _id: req.params.id,
            role: { $in: HOTEL_SCOPED_ROLES }
        },
        {
            $set: {
                ...req.body,
                hotelId
            },
            $inc: {
                tokenVersion: 1
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!user) {
        throw new ApiError(
            404,
            "Editable staff account not found"
        );
    }

    res.json({
        message: "Staff updated; old sessions revoked",
        user: publicUser(user)
    });
}