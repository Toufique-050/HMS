import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import http, { errorMessage } from "../api/http.js";
import PendingApprovalNotice from "./PendingApprovalNotice.jsx";

const titles = {
    dashboard: "Your stay, at a glance",
    bookings: "My bookings",
    services: "Service requests",
    maintenance: "Maintenance requests",
    invoices: "My invoices",
    notifications: "Notifications",
    detail: "Booking details"
};

const bookingStatuses = [
    "pending_approval",
    "confirmed",
    "rejected",
    "checked_in",
    "checked_out",
    "cancelled",
    "no_show"
];

const paymentOptions = [
    ["cash", "Cash / Pay at hotel"],
    ["card_demo", "Debit / Credit Card — Demo"],
    ["jazzcash_demo", "JazzCash — Demo"],
    ["easypaisa_demo", "Easypaisa — Demo"]
];

const paymentLabels = Object.fromEntries(paymentOptions);

const money = value =>
    `Rs. ${Number(value || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const day = value =>
    value ? String(value).slice(0, 10) : "—";

const statusText = value =>
    String(value || "—").replaceAll("_", " ");

const recordId = value =>
    String(value?._id || value || "");

const dateTime = value =>
    value
        ? new Date(value).toLocaleString("en-PK", {
            timeZone: "Asia/Karachi"
        })
        : "—";

export default function GuestPage({ resource }) {
    const { bookingId } = useParams();

    const [data, setData] = useState(null);
    const [options, setOptions] = useState({
        bookings: [],
        services: []
    });

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [page, setPage] = useState(1);
    const [status, setStatus] = useState("");
    const [version, setVersion] = useState(0);
    const [paymentPreference, setPaymentPreference] =
        useState("");

    const submitting = useRef(false);
    const feedbackRef = useRef(null);
    const historyRef = useRef(null);
    const silentReload = useRef(false);
    const justSubmitted = useRef(false);
    const [highlightId, setHighlightId] = useState("");

    const [form, setForm] = useState({
        bookingId: "",
        serviceId: "",
        quantity: 1,
        scheduledAt: "",
        notes: "",
        issue: "",
        priority: "medium",
        rating: 5,
        comment: ""
    });

    useEffect(() => {
        const controller = new AbortController();

        const silent = silentReload.current;
        silentReload.current = false;

        if (!silent) setLoading(true);
        setError("");

        async function load() {
            try {
                const path = resource === "detail"
                    ? `/guest/bookings/${bookingId}`
                    : `/guest/${resource}`;

                const params = [
                    "dashboard",
                    "detail"
                ].includes(resource)
                    ? {}
                    : {
                        page,
                        limit: 10,
                        ...(resource === "bookings" && status
                            ? { status }
                            : {})
                    };

                const response = await http.get(path, {
                    params,
                    signal: controller.signal
                });

                let nextOptions;

                if ([
                    "services",
                    "maintenance"
                ].includes(resource)) {
                    const responseOptions = await http.get(
                        "/guest/options",
                        {
                            signal: controller.signal
                        }
                    );

                    nextOptions = responseOptions.data;
                }

                if (controller.signal.aborted) return;

                setData(response.data);

                if (nextOptions) {
                    setOptions(nextOptions);
                }

                if (resource === "detail") {
                    const preference =
                        response.data.item.paymentPreference;

                    setPaymentPreference(
                        paymentLabels[preference]
                            ? preference
                            : ""
                    );
                }
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => controller.abort();
    }, [
        resource,
        bookingId,
        page,
        status,
        version
    ]);

    // Submit ke baad success message par scroll karo
    useEffect(() => {
        if (
            !success ||
            !["services", "maintenance"].includes(resource)
        ) {
            return;
        }

        requestAnimationFrame(() => {
            feedbackRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
            feedbackRef.current?.focus({ preventScroll: true });
        });
    }, [success, resource]);

    // Nayi request ko highlight karo
    useEffect(() => {
        if (
            justSubmitted.current &&
            !loading &&
            data?.items?.length
        ) {
            justSubmitted.current = false;
            setHighlightId(data.items[0]._id);
        }
    }, [data, loading]);

    useEffect(() => {
        if (!highlightId) return;

        const timer = setTimeout(() => setHighlightId(""), 8000);

        return () => clearTimeout(timer);
    }, [highlightId]);

    function viewHistory() {
        historyRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    function updateField(event) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value,
            ...(name === "bookingId"
                ? { serviceId: "" }
                : {})
        }));
    }

    async function mutate(
        method,
        path,
        body,
        fallbackMessage = "Saved successfully."
    ) {
        if (submitting.current) return;

        submitting.current = true;
        setBusy(true);
        setError("");
        setSuccess("");

        try {
            const response = await http.request({
                method,
                url: `/guest/${path}`,
                data: body
            });

            setSuccess(
                response.data.message || fallbackMessage
            );

            setForm(previous => ({
                ...previous,
                notes: "",
                issue: "",
                comment: "",
                scheduledAt: ""
            }));

            if (
                method === "post" &&
                ["services", "maintenance"].includes(path)
            ) {
                justSubmitted.current = true;
                setPage(1);
            }

            silentReload.current = true;
            setVersion(value => value + 1);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    }

    function submitRequest(event) {
        event.preventDefault();

        if (resource === "maintenance") {
            mutate("post", "maintenance", {
                bookingId: form.bookingId,
                issue: form.issue,
                priority: form.priority
            });

            return;
        }

        const body = {
            bookingId: form.bookingId,
            serviceId: form.serviceId,
            quantity: Number(form.quantity),
            notes: form.notes
        };

        if (form.scheduledAt) {
            const value = new Date(form.scheduledAt);

            if (Number.isNaN(value.getTime())) {
                setError("Choose a valid service time.");
                return;
            }

            body.scheduledAt = value.toISOString();
        }

        mutate("post", "services", body);
    }

    function bookingCard(booking) {
        return (
            <article className="gs-card" key={booking._id}>
                <span className="gs-tag">
                    {statusText(booking.status)}
                </span>

                <h2>
                    {booking.hotelId?.name || "Hotel"}
                </h2>

                <p className="gs-reference">
                    {booking.reference}
                </p>

                <p>
                    {day(booking.checkIn)}
                    {" → "}
                    {day(booking.checkOut)}
                </p>

                <p>
                    {booking.roomTypeId?.name || "Room"}
                    {" · Room "}
                    {booking.roomId?.roomNumber || "—"}
                </p>

                <p>{booking.guests} guest(s)</p>

                <p>
                    Payment option:{" "}
                    {paymentLabels[
                        booking.paymentPreference
                    ] || "Not selected"}
                </p>

                {booking.status === "pending_approval" && (
                    <p>
                        Awaiting hotel approval.
                        {!paymentLabels[
                            booking.paymentPreference
                        ] && (
                            <>
                                {" "}Open booking details
                                to select your payment option.
                            </>
                        )}
                    </p>
                )}

                {booking.status === "rejected" && (
                    <p>
                        Reason:{" "}
                        {booking.approval?.rejectionReason ||
                            "Contact the hotel for details."}
                    </p>
                )}

                <Link
                    className="gs-button gs-secondary"
                    to={`/guest/bookings/${booking._id}`}
                >
                    View booking
                </Link>
            </article>
        );
    }

    const selectedBooking = options.bookings.find(
        booking => booking._id === form.bookingId
    );

    const availableServices = options.services.filter(
        service =>
            recordId(service.hotelId) ===
            recordId(selectedBooking?.hotelId)
    );

    const selectedService = availableServices.find(
        service => service._id === form.serviceId
    );

    const item = resource === "detail"
        ? data?.item
        : null;

    return (
        <>
            <header className="gs-hero">
                <div>
                    <span className="gs-eyebrow">
                        LUXURYSTAY · GUEST WORKSPACE
                    </span>

                    <h1>{titles[resource]}</h1>

                    <p>
                        Your reservations and hotel assistance
                        in one place.
                    </p>
                </div>

                <button
                    type="button"
                    className="gs-button gs-secondary"
                    disabled={loading || busy}
                    onClick={() =>
                        setVersion(value => value + 1)
                    }
                >
                    Refresh
                </button>
            </header>

            {resource === "dashboard" && <PendingApprovalNotice />}

            {error && (
                <p className="gs-error" role="alert">
                    {error}
                </p>
            )}

            {success && (
                <p
                    ref={feedbackRef}
                    className="gs-success"
                    role="status"
                    tabIndex={-1}
                >
                    {success}

                    {["services", "maintenance"].includes(
                        resource
                    ) && (
                        <>
                            {" "}
                            <button
                                type="button"
                                className="gs-success-action"
                                onClick={viewHistory}
                            >
                                View my request ↓
                            </button>
                        </>
                    )}
                </p>
            )}

            {loading && (
                <p role="status">
                    Loading your information…
                </p>
            )}

            {!loading && data && (
                <>
                    {resource === "dashboard" && (
                        <>
                            <div className="gs-stats">
                                {[
                                    [
                                        "pendingApproval",
                                        "Awaiting approval"
                                    ],
                                    [
                                        "confirmed",
                                        "Confirmed bookings"
                                    ],
                                    ["checkedIn", "Current stays"],
                                    ["completed", "Completed stays"],
                                    ["rejected", "Rejected requests"],
                                    [
                                        "unread",
                                        "Unread notifications"
                                    ]
                                ].map(([key, title]) => (
                                    <article
                                        className="gs-card"
                                        key={key}
                                    >
                                        <span>{title}</span>
                                        <strong>
                                            {data.stats[key] ?? 0}
                                        </strong>
                                    </article>
                                ))}
                            </div>

                            <div className="gs-actions">
                                <Link
                                    className="gs-button"
                                    to="/guest/new-booking"
                                >
                                    Book another stay
                                </Link>

                                <Link
                                    className="gs-button gs-secondary"
                                    to="/guest/bookings"
                                >
                                    All my bookings
                                </Link>

                                <Link
                                    className="gs-button gs-secondary"
                                    to="/guest/notifications"
                                >
                                    Notifications
                                </Link>
                            </div>

                            <h2>
                                Pending, upcoming and current stays
                            </h2>

                            <div className="gs-grid">
                                {data.stays.map(bookingCard)}
                            </div>

                            {!data.stays.length && (
                                <p className="gs-empty">
                                    No pending, upcoming or current stays.
                                </p>
                            )}
                        </>
                    )}

                    {resource === "bookings" && (
                        <>
                            <label className="gs-filter">
                                Booking status

                                <select
                                    value={status}
                                    disabled={busy}
                                    onChange={event => {
                                        setStatus(
                                            event.target.value
                                        );
                                        setPage(1);
                                        setSuccess("");
                                    }}
                                >
                                    <option value="">
                                        All bookings
                                    </option>

                                    {bookingStatuses.map(value => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {statusText(value)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="gs-grid">
                                {data.items.map(bookingCard)}
                            </div>
                        </>
                    )}

                    {resource === "detail" && item && (
                        <>
                            <Link to="/guest/bookings">
                                Back to bookings
                            </Link>

                            <article className="gs-card">
                                <span className="gs-tag">
                                    {statusText(item.status)}
                                </span>

                                <h2>
                                    {item.hotelId?.name || "Hotel"}
                                </h2>

                                <p className="gs-reference">
                                    {item.reference}
                                </p>

                                <p>
                                    {day(item.checkIn)}
                                    {" → "}
                                    {day(item.checkOut)}
                                </p>

                                <p>
                                    Room:{" "}
                                    {item.roomId?.roomNumber || "—"}
                                </p>

                                <p>
                                    Booked nightly rate:{" "}
                                    {money(item.rateSnapshot)}
                                </p>

                                <p>Guests: {item.guests}</p>

                                <p>
                                    Check-in:{" "}
                                    {data.settings?.checkInTime ||
                                        "14:00"}
                                    {" · Check-out: "}
                                    {data.settings?.checkOutTime ||
                                        "12:00"}
                                </p>

                                <p>
                                    Payment option:{" "}
                                    <strong>
                                        {paymentLabels[
                                            item.paymentPreference
                                        ] || "Not selected"}
                                    </strong>
                                </p>

                                {item.status ===
                                    "pending_approval" && (
                                    <p>
                                        Your reservation is awaiting
                                        Admin or Manager approval.
                                        Payment remains pending.
                                    </p>
                                )}

                                {item.status === "confirmed" && (
                                    <p className="gs-success">
                                        Your reservation is confirmed.
                                        Check your invoice for the
                                        current payment balance.
                                    </p>
                                )}

                                {item.status === "rejected" && (
                                    <div className="gs-error">
                                        <p>
                                            Your reservation was rejected.
                                        </p>
                                        <p>
                                            Reason:{" "}
                                            {item.approval
                                                ?.rejectionReason ||
                                                "Contact the hotel."}
                                        </p>
                                        <p>
                                            No amount is due for this
                                            rejected request.
                                        </p>
                                    </div>
                                )}

                                {item.approval?.reviewedAt && (
                                    <p>
                                        Reviewed:{" "}
                                        {dateTime(
                                            item.approval.reviewedAt
                                        )}
                                    </p>
                                )}

                                <h3>Cancellation policy</h3>

                                <p>
                                    {data.settings
                                        ?.cancellationPolicy ||
                                        "Contact the hotel for its cancellation policy."}
                                </p>

                                {[
                                    "pending_approval",
                                    "confirmed"
                                ].includes(item.status) && (
                                    <>
                                        <p>
                                            Pending requests can be
                                            cancelled online if unpaid.
                                            Confirmed reservations can
                                            be cancelled online before
                                            the arrival date if unpaid.
                                            Contact the hotel for paid
                                            reservations.
                                        </p>

                                        <button
                                            type="button"
                                            className="gs-button gs-danger"
                                            disabled={busy}
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        "Cancel this reservation?"
                                                    )
                                                ) {
                                                    mutate(
                                                        "post",
                                                        `bookings/${bookingId}/cancel`,
                                                        {}
                                                    );
                                                }
                                            }}
                                        >
                                            Cancel reservation
                                        </button>
                                    </>
                                )}

                                <div className="gs-actions">
                                    <Link to="/guest/invoices">
                                        View my invoices
                                    </Link>

                                    <Link to="/guest/notifications">
                                        View notifications
                                    </Link>
                                </div>
                            </article>

                            {item.status ===
                                "pending_approval" && (
                                <form
                                    className="gs-card gs-form"
                                    onSubmit={event => {
                                        event.preventDefault();

                                        mutate(
                                            "patch",
                                            `bookings/${bookingId}/payment-preference`,
                                            { paymentPreference }
                                        );
                                    }}
                                >
                                    <h2>Payment option</h2>

                                    <label>
                                        Choose payment method

                                        <select
                                            required
                                            disabled={busy}
                                            value={paymentPreference}
                                            onChange={event =>
                                                setPaymentPreference(
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select an option
                                            </option>

                                            {paymentOptions.map(
                                                ([value, label]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>

                                    {paymentPreference ===
                                        "cash" && (
                                        <p>
                                            Pay at the hotel.
                                            Reception staff will record
                                            payment after receiving it.
                                        </p>
                                    )}

                                    {paymentPreference &&
                                        paymentPreference !==
                                            "cash" && (
                                        <p>
                                            Demo online payment option.
                                            No money is charged.
                                            Do not provide real card
                                            details, PIN or OTP.
                                            Selecting this method does
                                            not mark your invoice paid.
                                        </p>
                                    )}

                                    <button
                                        className="gs-button"
                                        disabled={
                                            busy ||
                                            !paymentPreference
                                        }
                                    >
                                        {busy
                                            ? "Saving…"
                                            : "Save payment option"}
                                    </button>
                                </form>
                            )}

                            {data.feedback && (
                                <article className="gs-card">
                                    <h2>Your feedback</h2>
                                    <p>
                                        {data.feedback.rating}/5
                                    </p>
                                    <p>
                                        {data.feedback.comment ||
                                            "No comment"}
                                    </p>
                                </article>
                            )}

                            {item.status === "checked_out" &&
                                !data.feedback && (
                                <form
                                    className="gs-card gs-form"
                                    onSubmit={event => {
                                        event.preventDefault();

                                        mutate("post", "feedback", {
                                            bookingId,
                                            rating: Number(
                                                form.rating
                                            ),
                                            comment: form.comment
                                        });
                                    }}
                                >
                                    <h2>How was your stay?</h2>

                                    <label>
                                        Rating
                                        <select
                                            name="rating"
                                            value={form.rating}
                                            onChange={updateField}
                                        >
                                            {[5, 4, 3, 2, 1].map(
                                                value => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {value}/5
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>

                                    <label>
                                        Comment
                                        <textarea
                                            name="comment"
                                            maxLength={2000}
                                            value={form.comment}
                                            onChange={updateField}
                                        />
                                    </label>

                                    <button
                                        className="gs-button"
                                        disabled={busy}
                                    >
                                        Submit feedback
                                    </button>
                                </form>
                            )}
                        </>
                    )}

                    {[
                        "services",
                        "maintenance"
                    ].includes(resource) && (
                        <div className="gs-request-layout">
                            <div className="gs-request-left">
                                {options.bookings.length ? (
                                <form
                                    className="gs-card gs-form gs-request-form"
                                    onSubmit={submitRequest}
                                >
                                    <h2>
                                        {resource === "services"
                                            ? "Request a service"
                                            : "Report a room problem"}
                                    </h2>

                                    <label>
                                        Current stay

                                        <select
                                            name="bookingId"
                                            required
                                            value={form.bookingId}
                                            onChange={updateField}
                                        >
                                            <option value="">
                                                Choose your stay
                                            </option>

                                            {options.bookings.map(
                                                booking => (
                                                    <option
                                                        key={booking._id}
                                                        value={booking._id}
                                                    >
                                                        {booking.hotelId?.name}
                                                        {" · Room "}
                                                        {booking.roomId
                                                            ?.roomNumber}
                                                        {" · "}
                                                        {booking.reference}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>

                                    {resource === "services" ? (
                                        <>
                                            <label>
                                                Service

                                                <select
                                                    name="serviceId"
                                                    required
                                                    value={form.serviceId}
                                                    onChange={updateField}
                                                >
                                                    <option value="">
                                                        Choose a service
                                                    </option>

                                                    {availableServices.map(
                                                        service => (
                                                            <option
                                                                key={service._id}
                                                                value={service._id}
                                                            >
                                                                {service.name}
                                                                {" · "}
                                                                {money(
                                                                    service.price
                                                                )}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>

                                            <label>
                                                Quantity
                                                <input
                                                    name="quantity"
                                                    type="number"
                                                    required
                                                    min="1"
                                                    max="100"
                                                    step="1"
                                                    value={form.quantity}
                                                    onChange={updateField}
                                                />
                                            </label>

                                            <label>
                                                Preferred time
                                                (optional, device timezone)
                                                <input
                                                    name="scheduledAt"
                                                    type="datetime-local"
                                                    value={form.scheduledAt}
                                                    onChange={updateField}
                                                />
                                            </label>

                                            <label>
                                                Notes
                                                <textarea
                                                    name="notes"
                                                    maxLength={2000}
                                                    value={form.notes}
                                                    onChange={updateField}
                                                />
                                            </label>

                                            {selectedService && (
                                                <p>
                                                    Estimated charge:{" "}
                                                    {money(
                                                        selectedService.price *
                                                        Number(
                                                            form.quantity || 0
                                                        )
                                                    )}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <label>
                                                Priority
                                                <select
                                                    name="priority"
                                                    value={form.priority}
                                                    onChange={updateField}
                                                >
                                                    {[
                                                        "low",
                                                        "medium",
                                                        "high",
                                                        "urgent"
                                                    ].map(value => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label>
                                                Describe the problem
                                                <textarea
                                                    name="issue"
                                                    required
                                                    minLength={5}
                                                    maxLength={2000}
                                                    value={form.issue}
                                                    onChange={updateField}
                                                />
                                            </label>

                                            <p>
                                                For emergencies, contact
                                                reception immediately.
                                            </p>
                                        </>
                                    )}

                                    <button
                                        className="gs-button"
                                        disabled={busy}
                                    >
                                        {busy
                                            ? "Submitting…"
                                            : "Submit request"}
                                    </button>
                                </form>
                            ) : (
                                <p className="gs-empty">
                                    New requests are available
                                    during a checked-in stay.
                                </p>
                            )}

                            </div>

                            <div className="gs-request-right">
                                <h2
                                    ref={historyRef}
                                    className="gs-request-history-title"
                                >
                                    Request history
                                </h2>

                                <div className="gs-grid gs-request-history">
                                    {[...data.items]
                                        .sort(
                                            (a, b) =>
                                                new Date(b.createdAt || 0) -
                                                new Date(a.createdAt || 0)
                                        )
                                        .map(request => (
                                    <article
                                        id={`request-${request._id}`}
                                        className={`gs-card${
                                            request._id === highlightId
                                                ? " gs-card-new"
                                                : ""
                                        }`}
                                        key={request._id}
                                    >
                                        {request._id === highlightId && (
                                            <span className="gs-new-badge">
                                                Just submitted
                                            </span>
                                        )}

                                        <span className="gs-tag">
                                            {statusText(request.status)}
                                        </span>

                                        <h3>
                                            {resource === "services"
                                                ? request.serviceId?.name ||
                                                    "Service"
                                                : "Maintenance request"}
                                        </h3>

                                        <p className="gs-reference">
                                            {request.bookingId?.reference}
                                        </p>

                                        {resource === "services" ? (
                                            <>
                                                <p>
                                                    Quantity:{" "}
                                                    {request.quantity}
                                                    {" · "}
                                                    {money(
                                                        request.quantity *
                                                        request.priceSnapshot
                                                    )}
                                                </p>

                                                {request.scheduledAt && (
                                                    <p>
                                                        Requested time:{" "}
                                                        {dateTime(
                                                            request.scheduledAt
                                                        )}
                                                    </p>
                                                )}

                                                <p>{request.notes}</p>
                                            </>
                                        ) : (
                                            <>
                                                <p>{request.issue}</p>
                                                <p>
                                                    Priority:{" "}
                                                    {request.priority}
                                                </p>

                                                {request.resolution && (
                                                    <p>
                                                        Resolution:{" "}
                                                        {request.resolution}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </article>
                                        ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {resource === "invoices" && (
                        <div className="gs-grid">
                            {data.items.map(invoice => {
                                const closedRequest = [
                                    "cancelled",
                                    "rejected"
                                ].includes(
                                    invoice.bookingId?.status
                                );

                                return (
                                    <article
                                        className="gs-card"
                                        key={invoice._id}
                                    >
                                        <span className="gs-tag">
                                            {closedRequest &&
                                            invoice.grandTotal === 0
                                                ? "No amount due"
                                                : statusText(
                                                    invoice.status
                                                )}
                                        </span>

                                        <h2>{invoice.number}</h2>

                                        <p className="gs-reference">
                                            {invoice.bookingId?.reference}
                                        </p>

                                        <p>
                                            Reservation:{" "}
                                            {statusText(
                                                invoice.bookingId?.status
                                            )}
                                        </p>

                                        <p>
                                            Total:{" "}
                                            {money(invoice.grandTotal)}
                                        </p>

                                        <p>
                                            Paid:{" "}
                                            {money(invoice.paid)}
                                        </p>

                                        <p>
                                            Balance:{" "}
                                            {money(invoice.balance)}
                                        </p>

                                        <Link
                                            className="gs-button gs-secondary"
                                            to={`/guest/invoices/${invoice._id}`}
                                        >
                                            View / print invoice
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {resource === "notifications" && (
                        <div className="gs-grid">
                            {data.items.map(notification => (
                                <article
                                    className="gs-card"
                                    key={notification._id}
                                >
                                    <span className="gs-tag">
                                        {notification.isRead
                                            ? "Read"
                                            : "Unread"}
                                    </span>

                                    <p>{notification.message}</p>

                                    <small>
                                        {dateTime(
                                            notification.createdAt
                                        )}
                                    </small>

                                    {!notification.isRead && (
                                        <div className="gs-actions">
                                            <button
                                                type="button"
                                                className="gs-button gs-secondary"
                                                disabled={busy}
                                                onClick={() =>
                                                    mutate(
                                                        "post",
                                                        `notifications/${notification._id}/read`,
                                                        {}
                                                    )
                                                }
                                            >
                                                Mark as read
                                            </button>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}

                    {data.items && (
                        <>
                            {!data.items.length && (
                                <p className="gs-empty">
                                    No records found.
                                </p>
                            )}

                            <div className="gs-pagination">
                                <button
                                    type="button"
                                    className="gs-button gs-secondary"
                                    disabled={page <= 1 || busy}
                                    onClick={() =>
                                        setPage(value => value - 1)
                                    }
                                >
                                    Previous
                                </button>

                                <span>
                                    {data.page} / {data.pages}
                                </span>

                                <button
                                    type="button"
                                    className="gs-button gs-secondary"
                                    disabled={
                                        page >= data.pages || busy
                                    }
                                    onClick={() =>
                                        setPage(value => value + 1)
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </>
    );
}