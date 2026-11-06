import mongoose from "mongoose";
import { setServers } from "node:dns/promises";

export default async function connectDatabase() {
    if (!process.env.MONGODB_URI) {
        throw new Error("Set MONGODB_URI in backend/.env");
    }

    setServers(["8.8.8.8", "8.8.4.4"]);

    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB connected successfully");
}