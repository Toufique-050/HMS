import nodemailer from "nodemailer";

import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import RoomType from "../models/RoomType.js";
import Invoice from "../models/Invoice.js";
import Setting from "../models/Setting.js";
import User from "../models/User.js";

function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    )
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toISOString().slice(0, 10);
}

function formatMoney(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    return `PKR ${amount.toFixed(2)}`;
}

function paymentLabel(value) {
    const labels = {
        not_selected: "Not selected",
        cash: "Cash",
        card_demo: "Card (demo option)",
        jazzcash_demo: "JazzCash (demo option)",
        easypaisa_demo: "Easypaisa (demo option)"
    };

    return labels[value] || "Not selected";
}

function getEmailContent(type, booking) {
    switch (type) {
        case "request_received":
            return {
                subject: `Booking request received — ${booking.reference}`,
                heading: "Booking request received",
                message:
                    "Thank you for choosing LuxuryStay. We have received " +
                    "your booking request. It is currently pending Admin " +
                    "approval. Please select your payment option in your " +
                    "guest account so the Admin can review your request."
            };

        case "confirmed":
            return {
                subject: `Booking confirmed — ${booking.reference}`,
                heading: "Your booking is confirmed",
                message:
                    "We are pleased to confirm your reservation. " +
                    "Please review your stay details below."
            };

        case "rejected":
            return {
                subject: `Booking request update — ${booking.reference}`,
                heading: "Your booking request was declined",
                message:
                    "We are sorry that we could not approve your " +
                    "reservation request."
            };

        case "cancelled":
            return {
                subject: `Booking cancelled — ${booking.reference}`,
                heading: "Your booking has been cancelled",
                message:
                    "Your reservation has been cancelled. " +
                    "Please contact the hotel if you need assistance."
            };

        case "expired":
            return {
                subject: `Booking request expired — ${booking.reference}`,
                heading: "Your booking request has expired",
                message:
                    "Your request was not approved within the approval " +
                    "window and has been automatically cancelled. " +
                    "You may submit a new booking request."
            };

        default:
            throw new Error("Unsupported booking email type");
    }
}

export async function sendBookingEmail(
    bookingId,
    type
) {
    const booking = await Booking.findById(bookingId)
        .lean();

    if (!booking) {
        throw new Error("Booking not found for email");
    }

    const guestEmail = booking.guestSnapshot?.email;

    if (!guestEmail) {
        throw new Error(
            "Booking has no guest email address"
        );
    }

    const {
        SMTP_HOST,
        SMTP_PORT = "587",
        SMTP_USER,
        SMTP_PASSWORD,
        SMTP_FROM
    } = process.env;

    if (
        !SMTP_HOST ||
        !SMTP_USER ||
        !SMTP_PASSWORD ||
        !SMTP_FROM
    ) {
        throw new Error(
            "Booking email SMTP settings are incomplete"
        );
    }

    const port = Number(SMTP_PORT);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error("Invalid SMTP_PORT");
    }

    const [
        hotel,
        roomType,
        invoice,
        setting
    ] = await Promise.all([
        Hotel.findById(booking.hotelId).lean(),

        RoomType.findById(booking.roomTypeId).lean(),

        Invoice.findOne({
            bookingId: booking._id,
            hotelId: booking.hotelId
        }).lean(),

        Setting.findOne({
            hotelId: booking.hotelId
        }).lean()
    ]);

    const content = getEmailContent(
        type,
        booking
    );

    const guestName =
        booking.guestSnapshot?.name || "Guest";

    const rejectionReason =
        booking.approval?.rejectionReason;

    const details = [
        ["Booking reference", booking.reference],
        ["Hotel", hotel?.name || "LuxuryStay"],
        ["Room type", roomType?.name || "—"],
        ["Check-in date", formatDate(booking.checkIn)],
        ["Check-out date", formatDate(booking.checkOut)],
        ["Guests", booking.guests]
    ];

    if (
        type === "request_received" ||
        type === "confirmed"
    ) {
        details.push(
            [
                "Booking status",
                type === "confirmed"
                    ? "Confirmed"
                    : "Pending approval"
            ],
            [
                "Payment option",
                paymentLabel(booking.paymentPreference)
            ],
            [
                "Booking total",
                invoice
                    ? formatMoney(invoice.grandTotal)
                    : "—"
            ]
        );
    }

    if (type === "confirmed") {
        details.push(
            [
                "Check-in time",
                setting?.checkInTime || "Contact hotel"
            ],
            [
                "Check-out time",
                setting?.checkOutTime || "Contact hotel"
            ]
        );
    }

    if (
        type === "rejected" &&
        rejectionReason
    ) {
        details.push([
            "Reason",
            rejectionReason
        ]);
    }

    const rows = details
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
                        <strong>${escapeHtml(label)}</strong>
                    </td>
                    <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
                        ${escapeHtml(value)}
                    </td>
                </tr>
            `
        )
        .join("");

    const html = `
        <div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto;">
            <h2 style="color:#176b87;">
                ${escapeHtml(hotel?.name || "LuxuryStay")}
            </h2>

            <h3>${escapeHtml(content.heading)}</h3>

            <p>Dear ${escapeHtml(guestName)},</p>

            <p>${escapeHtml(content.message)}</p>

            <table style="border-collapse:collapse;width:100%;">
                ${rows}
            </table>

            <p style="margin-top:24px;">
                Thank you,<br>
                <strong>LuxuryStay Team</strong>
            </p>
        </div>
    `;

    const text = [
        content.heading,
        "",
        `Dear ${guestName},`,
        "",
        content.message,
        "",
        ...details.map(
            ([label, value]) => `${label}: ${value}`
        ),
        "",
        "Thank you,",
        "LuxuryStay Team"
    ].join("\n");

    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,

        auth: {
            user: SMTP_USER,
            pass: SMTP_PASSWORD
        },

        connectionTimeout: 10000,
        socketTimeout: 15000
    });

    try {
        const result = await transport.sendMail({
            from: SMTP_FROM,
            to: guestEmail,
            subject: content.subject,
            text,
            html
        });

        if (!result.accepted?.length) {
            throw new Error(
                "Mail server did not accept the email"
            );
        }

        return {
            sent: true
        };
    } finally {
        transport.close();
    }
}

/*
 * Call only AFTER the booking transaction has committed.
 * Email failure must not undo a successful booking action.
 */
export async function trySendBookingEmail(
    bookingId,
    type
) {
    try {
        await sendBookingEmail(
            bookingId,
            type
        );

        return true;
    } catch {
        console.error(
            `Booking email could not be sent. Type: ${type}. ` +
            "Check SMTP settings and mail server connectivity."
        );

        return false;
    }
}


export async function sendAdminNewBookingEmail(bookingId) {
    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
        throw new Error("Booking not found");
    }

    const admin = await User.findOne({
        role: "Admin",
        isActive: true
    })
        .select("name email")
        .lean();

    if (!admin?.email) {
        throw new Error("Active Admin email not found");
    }

    const [
        hotel,
        roomType,
        invoice
    ] = await Promise.all([
        Hotel.findById(booking.hotelId).lean(),
        RoomType.findById(booking.roomTypeId).lean(),
        Invoice.findOne({
            bookingId: booking._id,
            hotelId: booking.hotelId
        }).lean()
    ]);

    const {
        SMTP_HOST,
        SMTP_PORT = "587",
        SMTP_USER,
        SMTP_PASSWORD,
        SMTP_FROM
    } = process.env;

    if (
        !SMTP_HOST ||
        !SMTP_USER ||
        !SMTP_PASSWORD ||
        !SMTP_FROM
    ) {
        throw new Error("Booking email SMTP settings are incomplete");
    }

    const port = Number(SMTP_PORT);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error("Invalid SMTP_PORT");
    }

    const guestName = booking.guestSnapshot?.name || "Guest";
    const guestEmail = booking.guestSnapshot?.email || "—";
    const guestPhone = booking.guestSnapshot?.phone || "—";

    const details = [
        ["Booking Reference", booking.reference],
        ["Guest Name", guestName],
        ["Guest Email", guestEmail],
        ["Guest Phone", guestPhone],
        ["Hotel", hotel?.name || "LuxuryStay"],
        ["Room Type", roomType?.name || "—"],
        ["Check-in", formatDate(booking.checkIn)],
        ["Check-out", formatDate(booking.checkOut)],
        ["Guests", booking.guests],
        ["Payment Preference", paymentLabel(booking.paymentPreference)],
        ["Booking Total", invoice ? formatMoney(invoice.grandTotal) : "—"],
        ["Booking Status", booking.status]
    ];

    const rows = details.map(([label, value]) => `
        <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
                <strong>${escapeHtml(label)}</strong>
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
                ${escapeHtml(value)}
            </td>
        </tr>
    `).join("");

    const html = `
        <div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto;">
            <h2 style="color:#176b87;">LuxuryStay Admin Notification</h2>

            <h3>New Booking Request Received</h3>

            <p>Dear ${escapeHtml(admin.name)},</p>

            <p>A new booking request has been submitted by a guest.
            Please review this reservation in your Admin Dashboard.</p>

            <table style="border-collapse:collapse;width:100%;">
                ${rows}
            </table>

            <p style="margin-top:24px;">
                <strong>LuxuryStay System Notification</strong>
            </p>
        </div>
    `;

    const text = [
        "New Booking Request Received",
        "",
        ...details.map(([label, value]) => `${label}: ${value}`),
        "",
        "Please review this reservation in your Admin Dashboard."
    ].join("\n");

    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 15000
    });

    try {
        const result = await transport.sendMail({
            from: SMTP_FROM,
            to: admin.email,
            subject: `New Booking Request — ${booking.reference}`,
            text,
            html
        });

        if (!result.accepted?.length) {
            throw new Error("Mail server did not accept the email");
        }

        return {
            sent: true
        };
    } finally {
        transport.close();
    }
}

export async function trySendAdminNewBookingEmail(bookingId) {
    try {
        await sendAdminNewBookingEmail(bookingId);
        return true;
    } catch (error) {
        console.error(
            "Admin new booking email could not be sent:",
            error.message
        );

        return false;
    }
}
