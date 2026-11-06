import { Booking, Hotel, Invoice } from "./models.js";
import { assert } from "./rules.js";
const escape = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


export async function emailInvoice(invoice) {
    assert(
        process.env.SMTP_HOST &&
        process.env.SMTP_FROM &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASSWORD,
        "Invoice email needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM in backend/.env",
        503
    );

    const booking = await Booking.findById(invoice.bookingId);
    const hotel = await Hotel.findById(invoice.hotelId);

    assert(booking?.guestSnapshot.email, "This reservation has no guest email");

    let nodemailer;

    try {
        nodemailer = (await import("nodemailer")).default;
    } catch {
        assert(false, "Install nodemailer in the backend before sending email", 503);
    }

    const port = Number(process.env.SMTP_PORT || 587);

    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        connectionTimeout: 10000,
        socketTimeout: 15000
    });

    const payments = invoice.payments || [];

    const paymentRows = payments.map(payment => `
        <tr>
            <td>PKR ${Number(payment.amount || 0).toFixed(2)}</td>
            <td>${escape(payment.method || "Not specified")}</td>
            <td>${payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-PK") : "N/A"}</td>
            <td>${escape(payment.reference || "N/A")}</td>
        </tr>
    `).join("");

    const html = `
        <div style="font-family:Arial,sans-serif;color:#263238;max-width:750px;margin:auto;">
            <h1 style="color:#0B3037;">${escape(hotel?.name || "LuxuryStay")}</h1>

            <h2>Invoice / Payment Receipt</h2>

            <p><strong>Invoice Number:</strong> ${escape(invoice.number)}</p>
            <p><strong>Guest Name:</strong> ${escape(booking.guestSnapshot.name)}</p>
            <p><strong>Booking Reference:</strong> ${escape(booking.reference)}</p>

            <p>
                <strong>Stay:</strong>
                ${booking.checkIn.toISOString().slice(0, 10)}
                to
                ${booking.checkOut.toISOString().slice(0, 10)}
            </p>

            <h3>Invoice Details</h3>

            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
                <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Unit Price (PKR)</th>
                    <th>Total (PKR)</th>
                </tr>

                ${invoice.chargeItems.map(v => `
                    <tr>
                        <td>${escape(v.label)}</td>
                        <td>${v.quantity}</td>
                        <td>${Number(v.unitPrice || 0).toFixed(2)}</td>
                        <td>${(Number(v.quantity || 0) * Number(v.unitPrice || 0)).toFixed(2)}</td>
                    </tr>
                `).join("")}
            </table>

            <h3>Payment Summary</h3>

            <p>
                Subtotal: PKR ${Number(invoice.subtotal || 0).toFixed(2)}<br>
                Tax (${invoice.taxRate}%): PKR ${Number(invoice.tax || 0).toFixed(2)}<br>
                Discount: PKR ${Number(invoice.discount || 0).toFixed(2)}<br>
                <strong>Total Bill: PKR ${Number(invoice.grandTotal || 0).toFixed(2)}</strong><br>
                Paid Amount: PKR ${Number(invoice.paid || 0).toFixed(2)}<br>
                Balance: PKR ${Number(invoice.balance || 0).toFixed(2)}
            </p>

            <h3>Payment Details</h3>

            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;">
                <tr>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Payment Date</th>
                    <th>Reference</th>
                </tr>

                ${paymentRows || `
                    <tr>
                        <td colspan="4">No payment details available</td>
                    </tr>
                `}
            </table>

            <p style="margin-top:25px;">
                Thank you for choosing ${escape(hotel?.name || "LuxuryStay")}.
            </p>
        </div>
    `;

    try {
        const result = await transport.sendMail({
            from: process.env.SMTP_FROM,
            to: booking.guestSnapshot.email,
            subject: `LuxuryStay Payment Receipt - ${invoice.number}`,
            html
        });

        assert(
            result.accepted?.length,
            "Email server did not accept the invoice",
            502
        );

        return { message: "Payment receipt accepted by the mail server" };
    } catch (error) {
        if (error.status) throw error;

        assert(
            false,
            "Email could not be sent. Check SMTP configuration and retry.",
            502
        );
    }
}


export async function emailPaymentReceipt(invoiceId) {
    const invoice = await Invoice.findOneAndUpdate(
        {
            _id: invoiceId,
            status: "paid",
            balance: 0,
           receiptEmailStatus: { $in: ["pending", null] }
        },
        {
            $set: {
                receiptEmailStatus: "processing"
            }
        },
        {
            new: true
        }
    );

    if (!invoice) {
        return { sent: false, skipped: true };
    }

    try {
        await emailInvoice(invoice);

        await Invoice.updateOne(
            { _id: invoice._id },
            {
                $set: {
                    receiptEmailStatus: "sent",
                    receiptEmailSentAt: new Date()
                }
            }
        );

        return { sent: true };
    } catch (error) {
        await Invoice.updateOne(
            { _id: invoice._id },
            {
                $set: {
                    receiptEmailStatus: "failed"
                }
            }
        );

        console.error(
            "Payment receipt email failed:",
            error.message
        );

        return { sent: false };
    }
}