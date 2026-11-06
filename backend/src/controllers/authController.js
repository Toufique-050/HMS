import bcrypt from "bcrypt";

import User from "../models/User.js";
import { ROLES } from "../config/roles.js";
import { createToken, publicUser } from "../utils/tokens.js";
import ApiError from "../utils/ApiError.js";

const dummyHash = await bcrypt.hash(
    "not-a-real-user-password",
    12
);

// Guest registration only.
export async function signUp(req, res) {
    const { name, email, password, phone } = req.body;

    const user = await User.create({
        name,
        email,
        phone,
        role: ROLES.GUEST,
        passwordHash: await bcrypt.hash(password, 12)
    });

    res.status(201).json({
        message: "Guest registered. Please log in",
        user: publicUser(user)
    });
}

// Common login for all five roles.
export async function login(req, res) {
    const user = await User.findOne({
        email: req.body.email
    }).select("+passwordHash +tokenVersion");

    const valid = await bcrypt.compare(
        req.body.password,
        user?.passwordHash || dummyHash
    );

    if (!user || !user.isActive || !valid) {
        throw new ApiError(401, "Invalid email or password");
    }

    res.json({
        message: "Login successful",
        token: createToken(user),
        role: user.role,
        user: publicUser(user)
    });
}

export function me(req, res) {
    res.json({
        user: publicUser(req.user)
    });
}

export async function logout(req, res) {
    await User.updateOne(
        { _id: req.user._id },
        { $inc: { tokenVersion: 1 } }
    );

    res.json({
        message: "Logged out from all sessions"
    });
}

export async function updateProfile(req, res) {
    const user = await User.findOneAndUpdate(
        {
            _id: req.user._id,
            isActive: true,
            tokenVersion: req.user.tokenVersion
        },
        {
            $set: {
                name: req.body.name,
                phone: req.body.phone
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (!user) {
        throw new ApiError(401, "Session ended");
    }

    res.json({
        user: publicUser(user)
    });
}

export async function changePassword(req, res) {
    const user = await User.findById(req.user._id)
        .select("+passwordHash +tokenVersion");

    if (
        !user ||
        !await bcrypt.compare(
            req.body.currentPassword,
            user.passwordHash
        )
    ) {
        throw new ApiError(
            400,
            "Current password is incorrect"
        );
    }

    if (req.body.currentPassword === req.body.newPassword) {
        throw new ApiError(400, "Choose a different password");
    }

    const result = await User.updateOne(
        {
            _id: user._id,
            isActive: true,
            passwordHash: user.passwordHash,
            tokenVersion: req.user.tokenVersion
        },
        {
            $set: {
                passwordHash: await bcrypt.hash(
                    req.body.newPassword,
                    12
                )
            },
            $inc: {
                tokenVersion: 1
            }
        }
    );

    if (!result.modifiedCount) {
        throw new ApiError(
            409,
            "Account changed. Log in again"
        );
    }

    res.json({
        message: "Password changed. Log in again"
    });
}