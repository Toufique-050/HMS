import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import http, { errorMessage } from "../api/http.js";
import { date, money, label } from "./config.js";

export default function InvoicePrintPage({ workspace = "receptionist" }) {
    const { invoiceId } = useParams();
    const [data, setData] = useState(null), [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        http.get(`/${workspace}/invoices/${invoiceId}/print`, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setData(result.data); })
            .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); });
        return () => controller.abort();
    }, [invoiceId, workspace]);
    if (error) return <p role="alert" className="rx-error">{error}</p>;
    if (!data) return <p role="status">Loading invoice…</p>;
    const { invoice, booking, hotel } = data;
    return <section className="rx-invoice-page">
        <div className="rx-print-tools"><Link className="rx-button rx-secondary" to={`/${workspace}/invoices`}>← Back to billing</Link><button className="rx-button" onClick={() => window.print()}>Print / Save as PDF</button></div>
        <article className="rx-invoice"><header className="rx-invoice-head"><div><span className="rx-eyebrow">LUXURYSTAY HOSPITALITY</span><h1>{hotel.name}</h1><p>{hotel.address}<br />{hotel.location}<br />{hotel.contact}</p></div><div><h2>Invoice</h2><strong>{invoice.number}</strong><p>Issued: {date(invoice.createdAt)}<br />Status: {label(invoice.status)}</p></div></header>
            <div className="rx-invoice-guests"><div><h3>Billed to</h3><strong>{booking.guestSnapshot.name}</strong><p>{booking.guestSnapshot.phone}<br />{booking.guestSnapshot.email}</p></div><div><h3>Stay details</h3><p>Booking: {booking.reference}<br />Room: {booking.roomId?.roomNumber}<br />Arrival: {date(booking.checkIn)}<br />Departure: {date(booking.checkOut)}<br />Billable nights: {Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000)}<br />Guests: {booking.guests}</p></div></div>
            <div className="rx-table-wrap"><table className="rx-table"><thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead><tbody>{invoice.chargeItems.map(item => <tr key={item._id}><td>{item.label}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div>
            <dl className="rx-totals">{[["Subtotal", invoice.subtotal], [`Tax (${invoice.taxRate}%)`, invoice.tax], ["Discount", invoice.discount], ["Grand total", invoice.grandTotal], ["Payments received", invoice.paid], ["Balance due", invoice.balance]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{money(value)}</dd></div>)}</dl>
            <h3>Payment history</h3>{invoice.payments.length ? <div className="rx-table-wrap"><table className="rx-table"><thead><tr><th scope="col">Date</th><th scope="col">Method</th><th scope="col">Reference</th><th scope="col">Amount</th></tr></thead><tbody>{invoice.payments.map(payment => <tr key={payment._id}><td>{date(payment.paidAt)}</td><td>{label(payment.method)}</td><td>{payment.reference || "—"}</td><td>{money(payment.amount)}</td></tr>)}</tbody></table></div> : <p>No payments recorded.</p>}
            <footer><p>Thank you for choosing {hotel.name}.</p><small>All amounts are in Pakistani rupees. This invoice shows the current recorded balance.</small></footer>
        </article>
    </section>;
}
