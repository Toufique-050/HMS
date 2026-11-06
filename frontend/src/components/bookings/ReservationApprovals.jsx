import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import http, { errorMessage } from "../../api/http.js";

const PAYMENT_LABELS = {
    not_selected: "Not selected",
    cash: "Cash / Pay at hotel",
    card_demo: "Debit / Credit Card — Demo",
    jazzcash_demo: "JazzCash — Demo",
    easypaisa_demo: "Easypaisa — Demo"
};

const STATUS_LABELS = {
    pending_approval: "Pending approval",
    confirmed: "Confirmed",
    rejected: "Rejected"
};

const VALID_PAYMENT_OPTIONS = [
    "cash",
    "card_demo",
    "jazzcash_demo",
    "easypaisa_demo"
];

const currency = value =>
    new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));

function dateText(value) {
    return value ? String(value).slice(0, 10) : "—";
}

function timestamp(value) {
    if (!value) return "—";

    return new Date(value).toLocaleString("en-PK", {
        timeZone: "Asia/Karachi"
    });
}

function stayNights(booking) {
    const arrival = Date.parse(booking.checkIn);
    const departure = Date.parse(booking.checkOut);

    return Math.max(
        0,
        Math.round((departure - arrival) / 86400000)
    );
}

const styles = {
    page: {
        display: "grid",
        gap: 20,
        minWidth: 0
    },

    heading: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
    },

    toolbar: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "end",
        gap: 16,
        padding: 20,
        background: "#fff",
        border: "1px solid #dbe3ec",
        borderRadius: 14
    },

    label: {
        display: "grid",
        gap: 8,
        flex: "1 1 180px"
    },

    field: {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        border: "1px solid #b8c7d8",
        borderRadius: 8,
        background: "#fff",
        color: "#14263d",
        font: "inherit"
    },

    card: {
        display: "grid",
        gap: 16,
        padding: 22,
        background: "#fff",
        color: "#14263d",
        border: "1px solid #dbe3ec",
        borderRadius: 14,
        overflowWrap: "anywhere"
    },

    details: {
        display: "grid",
        gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        margin: 0
    },

    detail: {
        display: "grid",
        gap: 5
    },

    term: {
        color: "#526477",
        fontSize: 14
    },

    value: {
        margin: 0,
        fontWeight: 600
    },

    actions: {
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center"
    },

    button: {
        border: "1px solid #c5d2df",
        borderRadius: 8,
        padding: "10px 16px",
        background: "#fff",
        color: "#14263d",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer"
    },

    approve: {
        border: "1px solid #146747",
        borderRadius: 8,
        padding: "10px 16px",
        background: "#146747",
        color: "#fff",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer"
    },

    reject: {
        border: "1px solid #a92c38",
        borderRadius: 8,
        padding: "10px 16px",
        background: "#a92c38",
        color: "#fff",
        font: "inherit",
        fontWeight: 600,
        cursor: "pointer"
    },

    notice: {
        padding: 14,
        borderRadius: 8,
        background: "#fff5da",
        color: "#654800",
        margin: 0
    },

    error: {
        padding: 14,
        borderRadius: 8,
        background: "#fff0f1",
        color: "#9b2233",
        margin: 0
    },

    success: {
        padding: 14,
        borderRadius: 8,
        background: "#eaf7ef",
        color: "#146747",
        margin: 0
    },

    rejectForm: {
        display: "grid",
        gap: 12,
        padding: 16,
        border: "1px solid #edc3c8",
        borderRadius: 10,
        background: "#fff9fa"
    }
};

export default function ReservationApprovals() {
    const { user } = useAuth();

   const isAdmin = user?.role === "Admin";
const allowed = isAdmin;

const portal = "/admin";
    const [hotels, setHotels] = useState([]);
    const [status, setStatus] = useState(
        "pending_approval"
    );
    const [hotelId, setHotelId] = useState("");
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);

    const [result, setResult] = useState({
        items: [],
        total: 0,
        page: 1,
        pages: 1
    });

    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState("");
    const [error, setError] = useState("");
    const [hotelError, setHotelError] = useState("");
    const [message, setMessage] = useState("");

    const [rejectingId, setRejectingId] = useState("");
    const [rejectionReason, setRejectionReason] =
        useState("");

    const submitting = useRef(false);

    useEffect(() => {
        if (!isAdmin) return;

        const controller = new AbortController();

        setHotelError("");

        http.get("/admin/hotels", {
            params: { limit: 500 },
            signal: controller.signal
        })
            .then(response => {
                setHotels(response.data.items || []);
            })
            .catch(caught => {
                if (!controller.signal.aborted) {
                    setHotelError(
                        "Hotel filter could not be loaded. You can still review all hotels."
                    );
                }
            });

        return () => controller.abort();
    }, [isAdmin]);

    useEffect(() => {
        if (!allowed) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        setLoading(true);
        setError("");

        const params = {
            status,
            page,
            limit: 20
        };

        if (isAdmin && hotelId) {
            params.hotelId = hotelId;
        }

        http.get("/reservation-reviews", {
            params,
            signal: controller.signal
        })
            .then(response => {
                if (!controller.signal.aborted) {
                    setResult(response.data);
                }
            })
            .catch(caught => {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [
        allowed,
        isAdmin,
        status,
        hotelId,
        page,
        reload
    ]);

    function resetReviewForm() {
        setRejectingId("");
        setRejectionReason("");
    }

    function changeStatus(value) {
        setStatus(value);
        setPage(1);
        setMessage("");
        resetReviewForm();
    }

    function changeHotel(value) {
        setHotelId(value);
        setPage(1);
        setMessage("");
        resetReviewForm();
    }

    async function review(booking, decision) {
        if (submitting.current) return;

        const reason = rejectionReason.trim();

        if (decision === "reject" && !reason) {
            setError("Enter a rejection reason.");
            return;
        }

        if (
            decision === "approve" &&
            !VALID_PAYMENT_OPTIONS.includes(
                booking.paymentPreference
            )
        ) {
            setError(
                "The guest must select a payment option before approval."
            );
            return;
        }

        submitting.current = true;
        setBusyId(booking._id);
        setError("");
        setMessage("");

        try {
            const body = decision === "approve"
                ? { decision: "approve" }
                : {
                    decision: "reject",
                    rejectionReason: reason
                };

            const response = await http.post(
                `/reservation-reviews/${booking._id}`,
                body
            );

            setMessage(response.data.message);
            resetReviewForm();

            // Avoid an empty last page after reviewing its last item.
            if (
                status === "pending_approval" &&
                result.items.length === 1 &&
                page > 1
            ) {
                setPage(previous => previous - 1);
            } else {
                setReload(previous => previous + 1);
            }
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            submitting.current = false;
            setBusyId("");
        }
    }

    if (!allowed) {
        return (
            <section>
                <h1>Access denied</h1>
               <p>
    Only Admin can approve or reject reservations.
</p>
            </section>
        );
    }

    const actionBusy = Boolean(busyId);

    return (
        <section style={styles.page}>
            <header style={styles.heading}>
                <div>
                    <h1>Reservation approvals</h1>
                    <p>
                        Review reservation requests,
                        payment preferences and decisions.
                    </p>
                    <p>
                        {isAdmin
                            ? "Scope: all hotels"
                            : "Scope: your assigned hotel"}
                    </p>
                </div>

                <button
                    type="button"
                    style={styles.button}
                    disabled={loading || actionBusy}
                    onClick={() =>
                        setReload(value => value + 1)
                    }
                >
                    Refresh
                </button>
            </header>

            <div style={styles.toolbar}>
                <label style={styles.label}>
                    Reservation status

                    <select
                        style={styles.field}
                        value={status}
                        disabled={actionBusy}
                        onChange={event =>
                            changeStatus(event.target.value)
                        }
                    >
                        <option value="pending_approval">
                            Pending approval
                        </option>
                        <option value="confirmed">
                            Confirmed
                        </option>
                        <option value="rejected">
                            Rejected
                        </option>
                    </select>
                </label>

                {isAdmin && (
                    <label style={styles.label}>
                        Hotel

                        <select
                            style={styles.field}
                            value={hotelId}
                            disabled={actionBusy}
                            onChange={event =>
                                changeHotel(
                                    event.target.value
                                )
                            }
                        >
                            <option value="">
                                All hotels
                            </option>

                            {hotels.map(hotel => (
                                <option
                                    key={hotel._id}
                                    value={hotel._id}
                                >
                                    {hotel.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <Link to={`${portal}/bookings`}>
                    Open reservations
                </Link>
            </div>

            <p style={styles.notice}>
                Approving a reservation does not mark
                its invoice paid. Online methods are
                demo preferences; no real payment is
                collected on this screen.
            </p>

            {hotelError && (
                <p style={styles.notice}>
                    {hotelError}
                </p>
            )}

            {message && (
                <p
                    role="status"
                    style={styles.success}
                >
                    {message}
                </p>
            )}

            {error && (
                <p
                    role="alert"
                    style={styles.error}
                >
                    {error}
                </p>
            )}

            {loading ? (
                <p role="status">
                    Loading reservations…
                </p>
            ) : error ? (
                <button
                    type="button"
                    style={styles.button}
                    disabled={actionBusy}
                    onClick={() =>
                        setReload(value => value + 1)
                    }
                >
                    Retry loading reservations
                </button>
            ) : (
                <>
                    <p>
                        {result.total} reservation(s)
                        {" · "}
                        {STATUS_LABELS[status]}
                    </p>

                    {!result.items.length && (
                        <article style={styles.card}>
                            <h2>No reservations found</h2>
                            <p>
                                No reservations match
                                the selected filters.
                            </p>
                        </article>
                    )}

                    {result.items.map(booking => {
                        const pending =
                            booking.status ===
                            "pending_approval";

                        const paymentSelected =
                            VALID_PAYMENT_OPTIONS.includes(
                                booking.paymentPreference
                            );

                        const nights = stayNights(booking);

                        const reviewing =
                            busyId === booking._id;

                        const reasonId =
                            `rejection-${booking._id}`;

                        return (
                            <article
                                key={booking._id}
                                style={styles.card}
                                aria-busy={reviewing}
                            >
                                <header>
                                    <h2>
                                        {booking.reference}
                                    </h2>

                                    <p>
                                        <strong>
                                            {
                                                STATUS_LABELS[
                                                    booking.status
                                                ] || booking.status
                                            }
                                        </strong>
                                    </p>
                                </header>

                                <dl style={styles.details}>
                                    <Detail label="Guest">
                                        {booking.guestSnapshot
                                            ?.name || "—"}
                                    </Detail>

                                    <Detail label="Email">
                                        {booking.guestSnapshot
                                            ?.email || "—"}
                                    </Detail>

                                    <Detail label="Phone">
                                        {booking.guestSnapshot
                                            ?.phone || "—"}
                                    </Detail>

                                    <Detail label="Hotel">
                                        {booking.hotelId
                                            ?.name || "—"}
                                    </Detail>

                                    <Detail label="Room type">
                                        {booking.roomTypeId
                                            ?.name || "—"}
                                    </Detail>

                                    <Detail label="Room">
                                        {booking.roomId
                                            ?.roomNumber || "—"}
                                    </Detail>

                                    <Detail label="Check-in">
                                        {dateText(
                                            booking.checkIn
                                        )}
                                    </Detail>

                                    <Detail label="Check-out">
                                        {dateText(
                                            booking.checkOut
                                        )}
                                    </Detail>

                                    <Detail label="Guests">
                                        {booking.guests}
                                    </Detail>

                                    <Detail label="Nights">
                                        {nights}
                                    </Detail>

                                    <Detail label="Booked nightly rate">
                                        {currency(
                                            booking.rateSnapshot
                                        )}
                                    </Detail>

                                    <Detail label="Room subtotal before tax/services">
                                        {currency(
                                            nights *
                                            booking.rateSnapshot
                                        )}
                                    </Detail>

                                    <Detail label="Payment preference">
                                        {
                                            PAYMENT_LABELS[
                                                booking.paymentPreference
                                            ] || "Not selected"
                                        }
                                    </Detail>

                                    <Detail label="Submitted">
                                        {timestamp(
                                            booking.createdAt
                                        )}
                                    </Detail>
                                </dl>

                                {pending && !paymentSelected && (
                                    <p style={styles.notice}>
                                        Waiting for the Guest
                                        to select a payment
                                        option. Approval is
                                        disabled until then.
                                    </p>
                                )}

                                {pending && (
                                    <>
                                        <div style={styles.actions}>
                                            <button
                                                type="button"
                                                style={styles.approve}
                                                disabled={
                                                    actionBusy ||
                                                    !paymentSelected
                                                }
                                                onClick={() =>
                                                    review(
                                                        booking,
                                                        "approve"
                                                    )
                                                }
                                            >
                                                {reviewing
                                                    ? "Processing…"
                                                    : "Approve reservation"}
                                            </button>

                                            <button
                                                type="button"
                                                style={styles.reject}
                                                disabled={actionBusy}
                                                onClick={() => {
                                                    setRejectingId(
                                                        booking._id
                                                    );
                                                    setRejectionReason("");
                                                    setError("");
                                                }}
                                            >
                                                Reject reservation
                                            </button>
                                        </div>

                                        {rejectingId ===
                                            booking._id && (
                                            <form
                                                style={
                                                    styles.rejectForm
                                                }
                                                onSubmit={event => {
                                                    event.preventDefault();
                                                    review(
                                                        booking,
                                                        "reject"
                                                    );
                                                }}
                                            >
                                                <label
                                                    htmlFor={reasonId}
                                                    style={styles.label}
                                                >
                                                    Rejection reason
                                                    <textarea
                                                        id={reasonId}
                                                        style={styles.field}
                                                        required
                                                        maxLength={500}
                                                        rows={3}
                                                        disabled={actionBusy}
                                                        value={rejectionReason}
                                                        onChange={event =>
                                                            setRejectionReason(
                                                                event.target.value
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <p>
                                                    The Guest will
                                                    receive this
                                                    reason. Rejection
                                                    releases the
                                                    reserved room nights.
                                                </p>

                                                <div
                                                    style={styles.actions}
                                                >
                                                    <button
                                                        style={styles.reject}
                                                        disabled={actionBusy}
                                                    >
                                                        Confirm rejection
                                                    </button>

                                                    <button
                                                        type="button"
                                                        style={styles.button}
                                                        disabled={actionBusy}
                                                        onClick={
                                                            resetReviewForm
                                                        }
                                                    >
                                                        Keep pending
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </>
                                )}

                                {booking.approval?.reviewedAt && (
                                    <div>
                                        <p>
                                            Reviewed by:{" "}
                                            <strong>
                                                {booking.approval
                                                    .reviewedBy
                                                    ?.name || "Staff"}
                                            </strong>
                                        </p>

                                        <p>
                                            Reviewed at:{" "}
                                            {timestamp(
                                                booking.approval
                                                    .reviewedAt
                                            )}
                                        </p>
                                    </div>
                                )}

                                {booking.status === "rejected" && (
                                    <p style={styles.notice}>
                                        Rejection reason:{" "}
                                        {booking.approval
                                            ?.rejectionReason || "—"}
                                    </p>
                                )}
                            </article>
                        );
                    })}

                    <nav
                        aria-label="Reservation approval pages"
                        style={styles.actions}
                    >
                        <button
                            type="button"
                            style={styles.button}
                            disabled={
                                page <= 1 || actionBusy
                            }
                            onClick={() => {
                                resetReviewForm();
                                setPage(value => value - 1);
                            }}
                        >
                            Previous
                        </button>

                        <span>
                            Page {result.page} of{" "}
                            {result.pages}
                        </span>

                        <button
                            type="button"
                            style={styles.button}
                            disabled={
                                page >= result.pages ||
                                actionBusy
                            }
                            onClick={() => {
                                resetReviewForm();
                                setPage(value => value + 1);
                            }}
                        >
                            Next
                        </button>
                    </nav>
                </>
            )}
        </section>
    );
}

function Detail({ label, children }) {
    return (
        <div style={styles.detail}>
            <dt style={styles.term}>
                {label}
            </dt>
            <dd style={styles.value}>
                {children}
            </dd>
        </div>
    );
}