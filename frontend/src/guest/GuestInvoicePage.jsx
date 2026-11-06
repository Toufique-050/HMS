import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import http, { errorMessage } from "../api/http.js";

const money = value =>
    `Rs. ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

export default function GuestInvoicePage() {
    const { invoiceId } = useParams();

    const [invoice, setInvoice] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError("");

        http.get(`/guest/invoices/${invoiceId}`, {
            signal: controller.signal
        })
            .then(({ data }) => {
                setInvoice(data.item);
            })
            .catch(error => {
                if (!controller.signal.aborted) {
                    setError(errorMessage(error));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [invoiceId]);

    if (loading) {
        return <p role="status">Loading invoice…</p>;
    }

    if (error) {
        return <p className="gs-error" role="alert">{error}</p>;
    }

    if (!invoice) {
        return null;
    }

    const booking = invoice.bookingId;

    return (
        <>
            <div className="gs-actions gs-no-print">
                <Link
                    className="gs-button gs-secondary"
                    to="/guest/invoices"
                >
                    ← My invoices
                </Link>

                <button
                    className="gs-button"
                    onClick={() => window.print()}
                >
                    Print / Save PDF
                </button>
            </div>

            <article className="gs-card gs-invoice">
                <span className="gs-eyebrow">LUXURYSTAY</span>

                <h1>Invoice {invoice.number}</h1>

                <h2>{invoice.hotelId?.name}</h2>

                <p>{invoice.hotelId?.address}</p>
                <p>{invoice.hotelId?.contact}</p>

                <hr />

                <p>
                    Guest: {booking?.guestSnapshot?.name}
                </p>

                <p>Reservation: {booking?.reference}</p>

                <p>
                    Stay: {booking?.checkIn?.slice(0, 10)}
                    {" → "}
                    {booking?.checkOut?.slice(0, 10)}
                </p>

                <p>
                    Reservation status:{" "}
                    {booking?.status?.replaceAll("_", " ")}
                </p>

                <div className="gs-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Quantity</th>
                                <th>Unit price</th>
                                <th>Amount</th>
                            </tr>
                        </thead>

                        <tbody>
                            {invoice.chargeItems.map((item, index) => (
                                <tr key={item._id || index}>
                                    <td>{item.label}</td>
                                    <td>{item.quantity}</td>
                                    <td>{money(item.unitPrice)}</td>
                                    <td>
                                        {money(
                                            item.quantity * item.unitPrice
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="gs-totals">
                    <p>
                        <span>Subtotal</span>
                        <strong>{money(invoice.subtotal)}</strong>
                    </p>

                    <p>
                        <span>Tax ({invoice.taxRate}%)</span>
                        <strong>{money(invoice.tax)}</strong>
                    </p>

                    <p>
                        <span>Discount</span>
                        <strong>{money(invoice.discount)}</strong>
                    </p>

                    <p>
                        <span>Grand total</span>
                        <strong>{money(invoice.grandTotal)}</strong>
                    </p>

                    <p>
                        <span>Paid</span>
                        <strong>{money(invoice.paid)}</strong>
                    </p>

                    <p>
                        <span>Balance</span>
                        <strong>{money(invoice.balance)}</strong>
                    </p>
                </div>
            </article>
        </>
    );
}