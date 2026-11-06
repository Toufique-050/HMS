
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import { ROLES } from "../config/roles.js";
import connectDatabase from "../config/database.js";
import { signupSchema } from "../validators/authValidator.js";

try {
    const input = signupSchema.parse({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });

    await connectDatabase();
    await User.init();

    let admin = await User.findOne({
        email: input.email
    });

    if (admin) {
        admin.name = input.name;
        admin.role = ROLES.ADMIN;
        admin.passwordHash = await bcrypt.hash(
            input.password,
            12
        );
        admin.isActive = true;

        await admin.save();

        console.log("Existing account converted to Admin successfully.");
    } else {
        admin = await User.findOne({
            role: ROLES.ADMIN
        });

        if (admin) {
            admin.name = input.name;
            admin.email = input.email;
            admin.passwordHash = await bcrypt.hash(
                input.password,
                12
            );
            admin.isActive = true;

            await admin.save();

            console.log("Existing Admin account updated successfully.");
        } else {
            await User.create({
                name: input.name,
                email: input.email,
                role: ROLES.ADMIN,
                passwordHash: await bcrypt.hash(
                    input.password,
                    12
                ),
                isActive: true
            });

            console.log("Initial Admin created successfully.");
        }
    }
} catch (error) {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
