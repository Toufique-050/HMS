import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

import approvalRoutes from "../src/routes/reservationApprovalRoutes.js";
import User from "../src/models/User.js";
import Booking from "../src/models/Booking.js";
import { createToken } from "../src/utils/tokens.js";
import errorHandler from "../src/middleware/errorHandler.js";

// These tests use model doubles, not a real MongoDB connection.

const hotelA = new mongoose.Types.ObjectId();
const hotelB = new mongoose.Types.ObjectId();
const bookingId = new mongoose.Types.ObjectId();

const admin = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test Admin",
    role: "Admin",
    isActive: true,
    tokenVersion: 0
};

const manager = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test Manager",
    role: "Manager",
    hotelId: hotelA,
    isActive: true,
    tokenVersion: 0
};

const receptionist = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test Receptionist",
    role: "Receptionist",
    hotelId: hotelA,
    isActive: true,
    tokenVersion: 0
};

const guest = {
    _id: new mongoose.Types.ObjectId(),
    name: "Test Guest",
    role: "Guest",
    isActive: true,
    tokenVersion: 0
};

const users = [admin, manager, receptionist, guest];

const reads = [];
const restore = [];

let app;
let originalSecret;

function queryResult(value) {
    return {
        select() {
            return this;
        },

        populate() {
            return this;
        },

        sort() {
            return this;
        },

        skip() {
            return this;
        },

        limit() {
            return this;
        },

        lean() {
            return Promise.resolve(value);
        },

        then(resolve, reject) {
            return Promise.resolve(value).then(resolve, reject);
        }
    };
}

function replace(object, method, replacement) {
    const original = object[method];

    object[method] = replacement;

    restore.push(() => {
        object[method] = original;
    });
}

// Admin is the default user for all permitted API requests.
function authenticatedGet(path, user = admin) {
    return request(app)
        .get(`/api/reservation-reviews${path}`)
        .set("Authorization", `Bearer ${createToken(user)}`);
}

function authenticatedPost(path, body, user = admin) {
    return request(app)
        .post(`/api/reservation-reviews${path}`)
        .set("Authorization", `Bearer ${createToken(user)}`)
        .send(body);
}

before(() => {
    originalSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET =
        "reservation-review-tests-secret-at-least-32-characters";

    replace(User, "findById", key => {
        const user = users.find(
            item => String(item._id) === String(key)
        );

        return queryResult(user || null);
    });

    replace(Booking, "find", filter => {
        reads.push({
            operation: "find",
            filter
        });

        return queryResult([]);
    });

    replace(Booking, "countDocuments", async filter => {
        reads.push({
            operation: "count",
            filter
        });

        return 0;
    });

    app = express();

    app.use(express.json());
    app.use("/api/reservation-reviews", approvalRoutes);
    app.use(errorHandler);
});

after(() => {
    for (const undo of restore.reverse()) {
        undo();
    }

    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

test("approval API requires login", async () => {
    const response = await request(app)
        .get("/api/reservation-reviews");

    assert.equal(response.status, 401);
});

test(
    "Guest and Receptionist cannot access reservation reviews",
    async () => {
        for (const user of [guest, receptionist]) {
            const listResponse = await authenticatedGet("", user);

            assert.equal(listResponse.status, 403);

            const reviewResponse = await authenticatedPost(
                `/${bookingId}`,
                { decision: "approve" },
                user
            );

            assert.equal(reviewResponse.status, 403);
        }
    }
);

test(
    "Manager cannot list, approve or reject reservations",
    async () => {
        reads.length = 0;

        const listResponse = await authenticatedGet("", manager);

        assert.equal(listResponse.status, 403);

        const filteredResponse = await authenticatedGet(
            `?hotelId=${hotelB}`,
            manager
        );

        assert.equal(filteredResponse.status, 403);
        assert.equal(reads.length, 0);

        for (const body of [
            { decision: "approve" },
            {
                decision: "reject",
                rejectionReason: "Test"
            }
        ]) {
            const response = await authenticatedPost(
                `/${bookingId}`,
                body,
                manager
            );

            assert.equal(response.status, 403);
        }
    }
);

test("Admin can list all hotels or filter one hotel", async () => {
    reads.length = 0;

    const allHotels = await authenticatedGet("", admin);

    assert.equal(allHotels.status, 200);

    assert.ok(
        reads.every(entry => entry.filter.hotelId === undefined)
    );

    reads.length = 0;

    const oneHotel = await authenticatedGet(
        `?hotelId=${hotelB}`,
        admin
    );

    assert.equal(oneHotel.status, 200);

    assert.ok(
        reads.every(
            entry =>
                String(entry.filter.hotelId) === String(hotelB)
        )
    );
});

test(
    "Pending, confirmed and rejected filters are supported",
    async () => {
        for (const status of [
            "pending_approval",
            "confirmed",
            "rejected"
        ]) {
            reads.length = 0;

            const response = await authenticatedGet(
                `?status=${status}`,
                admin
            );

            assert.equal(response.status, 200);

            assert.ok(
                reads.every(
                    entry => entry.filter.status === status
                )
            );
        }

        const invalid = await authenticatedGet(
            "?status=invalid_status",
            admin
        );

        assert.equal(invalid.status, 400);
    }
);

test("Invalid booking IDs and decisions are rejected", async () => {
    const invalidId = await authenticatedPost(
        "/invalid-id",
        { decision: "approve" },
        admin
    );

    assert.equal(invalidId.status, 400);

    const invalidDecision = await authenticatedPost(
        `/${bookingId}`,
        { decision: "paid" },
        admin
    );

    assert.equal(invalidDecision.status, 400);
});

test("Rejection requires a nonempty reason", async () => {
    const response = await authenticatedPost(
        `/${bookingId}`,
        {
            decision: "reject",
            rejectionReason: "   "
        },
        admin
    );

    assert.equal(response.status, 400);
});

test(
    "Approval payload cannot inject payment or hotel changes",
    async () => {
        const response = await authenticatedPost(
            `/${bookingId}`,
            {
                decision: "approve",
                hotelId: String(hotelB),
                paid: 33000,
                status: "checked_in"
            },
            admin
        );

        assert.equal(response.status, 400);
    }
);

test("Inactive Admin sessions lose approval access", async () => {
    admin.isActive = false;

    try {
        const response = await authenticatedGet("", admin);

        assert.equal(response.status, 401);
    } finally {
        admin.isActive = true;
    }
});