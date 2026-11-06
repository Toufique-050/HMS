import express from "express";
import mongoose from "mongoose";

import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import RoomType from "../models/RoomType.js";
import Booking from "../models/Booking.js";
import RoomNight from "../models/RoomNight.js";
import Invoice from "../models/Invoice.js";
import Setting from "../models/Setting.js";
import User from "../models/User.js";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";

import {
    trySendBookingEmail,
    trySendAdminNewBookingEmail
} from "../services/bookingEmailService.js";

const router = express.Router();

function validId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
        !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function dateValue(value) {
    return new Date(`${value}T00:00:00.000Z`);
}

function getNights(checkIn, checkOut) {
    const start = dateValue(checkIn);
    const end = dateValue(checkOut);

    return Math.round(
        (end.getTime() - start.getTime()) / 86400000
    );
}

function getNightDates(checkIn, count) {
    const dates = [];
    const start = dateValue(checkIn);

    for (let i = 0; i < count; i++) {
        dates.push(
            new Date(start.getTime() + i * 86400000)
        );
    }

    return dates;
}

function roundAmount(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}


function makeReference(prefix) {
    return `${prefix}-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
}

function makeInvoiceNumber(prefix) {
    return `${prefix || "LS"}-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
}


function validateDates(checkIn, checkOut) {
    if (!validDate(checkIn) || !validDate(checkOut)) {
        return {
            valid: false,
            message: "Please select valid check-in and check-out dates."
        };
    }

    const count = getNights(checkIn, checkOut);

    if (count < 1 || count > 365) {
        return {
            valid: false,
            message: "Check-out must be after check-in. Maximum stay is 365 nights."
        };
    }

    const today = new Date();
    const todayString = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi"
    }).format(today);

    if (checkIn < todayString) {
        return {
            valid: false,
            message: "Check-in date cannot be in the past."
        };
    }

    return {
        valid: true,
        count
    };
}

router.get("/hotels", async (req, res, next) => {
    try {
        const hotels = await Hotel.find({
            isActive: true
        })
            .select("name location address contact images facilities isActive")
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            hotels
        });
    } catch (error) {
        next(error);
    }
});

router.get("/hotels/:id", async (req, res, next) => {
    try {
        if (!validId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid hotel ID."
            });
        }

        const hotel = await Hotel.findOne({
            _id: req.params.id,
            isActive: true
        }).lean();

        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: "Hotel not found."
            });
        }

        res.json({
            success: true,
            hotel
        });
    } catch (error) {
        next(error);
    }
});

router.get("/rooms", async (req, res, next) => {
    try {
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 10, 1),
            50
        );

        const rooms = await Room.find({
            isActive: true,
            maintenanceStatus: "operational"
        })
            .populate("hotelId", "name location images facilities")
            .populate({
                path: "roomTypeId",
                match: { isActive: true },
                select: "name capacity baseRate amenities images"
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const items = rooms
            .filter(room => room.roomTypeId && room.hotelId)
            .map(room => ({
                ...room,
                name: room.roomTypeId.name,
                capacity: room.roomTypeId.capacity,
                baseRate: room.roomTypeId.baseRate,
                amenities: room.roomTypeId.amenities || [],
                images: room.roomTypeId.images || [],
                hotel: room.hotelId
            }));

        res.json({
            success: true,
            total: items.length,
            items,
            page: 1,
            pages: 1,
            datesChecked: false
        });
    } catch (error) {
        next(error);
    }
});

router.get("/rooms/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!validId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid room ID."
            });
        }

        const room = await Room.findOne({
            _id: id,
            isActive: true,
            maintenanceStatus: "operational"
        })
            .populate({
                path: "hotelId",
                match: { isActive: true },
                select: "name location address contact images facilities"
            })
            .populate({
                path: "roomTypeId",
                match: { isActive: true },
                select: "name capacity baseRate amenities images"
            })
            .lean();

        if (!room || !room.hotelId || !room.roomTypeId) {
            return res.status(404).json({
                success: false,
                message: "Room not found or is currently unavailable."
            });
        }

        const roomType = room.roomTypeId;

        const setting = await Setting.findOne({
            hotelId: room.hotelId._id
        })
            .select("checkInTime checkOutTime cancellationPolicy privacyPolicy")
            .lean();

        const checkIn = req.query.checkIn;
        const checkOut = req.query.checkOut;
        const guests = Math.max(
            parseInt(req.query.guests, 10) || 1,
            1
        );

        let quote = null;
        let availableRooms = await Room.countDocuments({
            hotelId: room.hotelId._id,
            roomTypeId: roomType._id,
            isActive: true,
            maintenanceStatus: "operational"
        });

        let datesChecked = false;

        if (checkIn || checkOut) {
            const dateCheck = validateDates(checkIn, checkOut);

            if (!dateCheck.valid) {
                return res.status(400).json({
                    success: false,
                    message: dateCheck.message
                });
            }

            if (guests > roomType.capacity) {
                return res.status(400).json({
                    success: false,
                    message: `This room allows a maximum of ${roomType.capacity} guests.`
                });
            }

            const dates = getNightDates(
                checkIn,
                dateCheck.count
            );

            const matchingRooms = await Room.find({
                hotelId: room.hotelId._id,
                roomTypeId: roomType._id,
                isActive: true,
                maintenanceStatus: "operational"
            })
                .select("_id")
                .lean();

            const roomIds = matchingRooms.map(item => item._id);

            const occupiedRoomIds = await RoomNight.distinct(
                "roomId",
                {
                    roomId: { $in: roomIds },
                    date: { $in: dates }
                }
            );

            availableRooms = Math.max(
                roomIds.length - occupiedRoomIds.length,
                0
            );

            const nightlyRate = roundAmount(roomType.baseRate);
            const subtotal = roundAmount(
                nightlyRate * dateCheck.count
            );

            quote = {
                nights: dateCheck.count,
                nightlyRate,
                subtotal,
                taxRate: 0,
                tax: 0,
                grandTotal: subtotal
            };

            datesChecked = true;
        }

        res.json({
            success: true,

            room: {
                ...room,
                name: roomType.name,
                capacity: roomType.capacity,
                baseRate: roomType.baseRate,
                amenities: roomType.amenities || [],
                images: roomType.images || [],
                hotel: room.hotelId
            },

            quote,
            availableRooms,
            datesChecked,

            policy: {
                checkInTime: setting?.checkInTime || "14:00",
                checkOutTime: setting?.checkOutTime || "12:00",
                cancellationPolicy: setting?.cancellationPolicy || "",
                privacyPolicy: setting?.privacyPolicy || ""
            }
        });
    } catch (error) {
        next(error);
    }
});

router.post(
    "/bookings",
    verifyToken,
    allowRoles("Guest"),
    async (req, res, next) => {
        let session;

        try {
            const {
                roomId,
                roomTypeId,
                checkIn,
                checkOut,
                guests,
                phone,
                acceptPolicies,
                expectedRate
            } = req.body;

            if (!validId(roomId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid room selection."
                });
            }

            const dateCheck = validateDates(
                checkIn,
                checkOut
            );

            if (!dateCheck.valid) {
                return res.status(400).json({
                    success: false,
                    message: dateCheck.message
                });
            }

            const guestCount = Number(guests);

            if (
                !Number.isInteger(guestCount) ||
                guestCount < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid number of guests."
                });
            }

            if (acceptPolicies !== true) {
                return res.status(400).json({
                    success: false,
                    message: "Please accept the hotel policies before booking."
                });
            }

            const guest = await User.findOne({
                _id: req.user._id,
                role: "Guest",
                isActive: true
            }).select("name email phone role");

            if (!guest) {
                return res.status(401).json({
                    success: false,
                    message: "Your Guest account is unavailable. Please log in again."
                });
            }

            const guestPhone = String(
                phone || guest.phone || ""
            ).trim();

            if (!guestPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide your contact phone number."
                });
            }

            session = await mongoose.startSession();

            let createdBooking;
            let createdInvoice;

            await session.withTransaction(async () => {
                const selectedRoom = await Room.findOne({
                    _id: roomId,
                    isActive: true,
                    maintenanceStatus: "operational"
                }).session(session);

                if (!selectedRoom) {
                    throw new Error("Selected room is unavailable.");
                }

                const [hotel, type] = await Promise.all([
                    Hotel.findOne({
                        _id: selectedRoom.hotelId,
                        isActive: true
                    }).session(session),

                    RoomType.findOne({
                        _id: selectedRoom.roomTypeId,
                        hotelId: selectedRoom.hotelId,
                        isActive: true
                    }).session(session)
                ]);

                if (!hotel || !type) {
                    throw new Error("Hotel or room type is no longer available.");
                }

                if (
                    roomTypeId &&
                    String(roomTypeId) !== String(type._id)
                ) {
                    throw new Error("Selected room type does not match this room.");
                }

                if (guestCount > type.capacity) {
                    throw new Error(
                        `This room allows a maximum of ${type.capacity} guests.`
                    );
                }

                if (
                    expectedRate !== undefined &&
                    Number(expectedRate) !== Number(type.baseRate)
                ) {
                    throw new Error(
                        "The room rate has changed. Refresh the page and try again."
                    );
                }

                const dates = getNightDates(
                    checkIn,
                    dateCheck.count
                );

                const existingLocks = await RoomNight.find({
                    roomId: selectedRoom._id,
                    date: { $in: dates }
                })
                    .session(session)
                    .lean();

                if (existingLocks.length > 0) {
                    throw new Error(
                        "This room is not available for all selected dates. Please choose another room or dates."
                    );
                }

                const setting = await Setting.findOne({
                    hotelId: hotel._id
                })
                    .session(session)
                    .lean();

                const nightlyRate = roundAmount(type.baseRate);
                const subtotal = roundAmount(
                    nightlyRate * dateCheck.count
                );

                const reference = makeReference("BK");

                const booking = new Booking({
                    reference,
                    guestId: guest._id,

                    guestSnapshot: {
                        name: guest.name,
                        email: guest.email || "",
                        phone: guestPhone
                    },

                    hotelId: hotel._id,
                    roomId: selectedRoom._id,
                    roomTypeId: type._id,

                    checkIn: dateValue(checkIn),
                    checkOut: dateValue(checkOut),

                    guests: guestCount,
                    rateSnapshot: nightlyRate,

                    status: "pending_approval",
                    paymentPreference: "not_selected"
                });

                await booking.save({ session });

                await RoomNight.insertMany(
                    dates.map(date => ({
                        roomId: selectedRoom._id,
                        date,
                        bookingId: booking._id
                    })),
                    { session }
                );

                const invoice = new Invoice({
                    number: makeInvoiceNumber(
                        setting?.invoicePrefix || "LS"
                    ),

                    bookingId: booking._id,
                    hotelId: hotel._id,

                    chargeItems: [{
                        label: `${type.name} - ${dateCheck.count} night(s)`,
                        quantity: dateCheck.count,
                        unitPrice: nightlyRate,
                        sourceId: "room"
                    }],

                    taxRate: 0,
                    discount: 0,

                    payments: [],

                    subtotal,
                    tax: 0,
                    grandTotal: subtotal,

                    paid: 0,
                    balance: subtotal,
                    status: "unpaid"
                });

                await invoice.save({ session });

                createdBooking = booking;
                createdInvoice = invoice;
            });

            await session.endSession();
            session = null;

            await trySendBookingEmail(
                createdBooking._id,
                "request_received"
            );

            await trySendAdminNewBookingEmail(
    createdBooking._id
);
            return res.status(201).json({
                success: true,
                message: "Reservation request submitted successfully. Please select your payment preference and wait for hotel approval.",

                item: {
                    _id: createdBooking._id,
                    reference: createdBooking.reference,
                    hotelId: createdBooking.hotelId,
                    roomId: createdBooking.roomId,
                    roomTypeId: createdBooking.roomTypeId,
                    checkIn: createdBooking.checkIn,
                    checkOut: createdBooking.checkOut,
                    guests: createdBooking.guests,
                    rateSnapshot: createdBooking.rateSnapshot,
                    status: createdBooking.status,
                    paymentPreference: createdBooking.paymentPreference,
                    createdAt: createdBooking.createdAt
                },

                invoice: {
                    _id: createdInvoice._id,
                    number: createdInvoice.number,
                    subtotal: createdInvoice.subtotal,
                    taxRate: 0,
                    tax: 0,
                    grandTotal: createdInvoice.grandTotal,
                    paid: 0,
                    balance: createdInvoice.balance,
                    status: createdInvoice.status
                }
            });
        } catch (error) {
            if (session) {
                await session.endSession();
            }

            if (error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: "This room has just been reserved for one or more selected dates. Please refresh and try again."
                });
            }

            if (
                /Transaction numbers|replica set|mongos/i.test(
                    error.message || ""
                )
            ) {
                return res.status(503).json({
                    success: false,
                    message: "Reservations require MongoDB Atlas or a MongoDB replica set."
                });
            }

            if (
                error.message?.startsWith("Selected") ||
                error.message?.startsWith("Hotel") ||
                error.message?.startsWith("This room") ||
                error.message?.startsWith("The room")
            ) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
      console.error("PUBLIC BOOKING ERROR:", error);
            next(error);
        }
    }
);

export default router;