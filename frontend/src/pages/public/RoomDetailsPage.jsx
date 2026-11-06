import { useRef, useState } from "react";
import Swal from "sweetalert2";

import {
    Link,
    useNavigate,
    useParams,
    useSearchParams
} from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import usePublic from "../../hooks/usePublic.js";
import http, { errorMessage } from "../../api/http.js";

import {
    Gallery,
    Hero,
    Policies,
    State,
    money,
    today,
    queryString
} from "../../components/public/Catalogue.jsx";

const PAYMENT_OPTIONS = [
    ["cash", "Cash / Pay at hotel"],
    ["card_demo", "Debit / Credit Card — Demo"],
    ["jazzcash_demo", "JazzCash — Demo"],
    ["easypaisa_demo", "Easypaisa — Demo"]
];

const PAYMENT_LABELS = Object.fromEntries(PAYMENT_OPTIONS);

function statusLabel(status) {
    return {
        pending_approval: "Pending approval",
        confirmed: "Confirmed",
        rejected: "Rejected",
        checked_in: "Checked in",
        checked_out: "Checked out",
        cancelled: "Cancelled",
        no_show: "No show"
    }[status] || status;
}

// Supports the existing reservation response, which may omit the ID.
async function findOwnBooking(reference) {
    let page = 1;

    while (true) {
        const response = await http.get("/guest/bookings", {
            params: {
                page,
               limit: 50
            }
        });

        const result = response.data;

        const booking = result.items.find(
            item => item.reference === reference
        );

        if (booking) {
            return booking;
        }

        if (page >= result.pages) {
            throw new Error("RESERVATION_LOOKUP_FAILED");
        }

        page += 1;
    }
}

export default function RoomDetailsPage() {
    const { roomId } = useParams();
    const [params] = useSearchParams();

    return (
        <RoomDetail
            key={`${roomId}?${params.toString()}`}
            roomId={roomId}
            params={params}
        />
    );
}

function RoomDetail({ roomId, params }) {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [, setSearchParams] = useSearchParams();

    const query = Object.fromEntries(
        ["checkIn", "checkOut", "guests"]
            .filter(key => params.get(key))
            .map(key => [key, params.get(key)])
    );

    const result = usePublic(`/rooms/${roomId}`, query);
    const data = result.data;
    const room = data?.room;
    const quote = data?.quote;

    const [form, setForm] = useState({
        checkIn: query.checkIn || "",
        checkOut: query.checkOut || "",
        guests: query.guests || "1"
    });

    const [phone, setPhone] = useState(user?.phone || "");
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [paymentBusy, setPaymentBusy] = useState(false);
    const [error, setError] = useState("");
    const [reservation, setReservation] = useState(null);

    const [paymentPreference, setPaymentPreference] =
        useState("");

    const saving = useRef(false);
    const savingPayment = useRef(false);
    const requestKey = useRef(crypto.randomUUID());

    const datesChanged =
        form.checkIn !== (query.checkIn || "") ||
        form.checkOut !== (query.checkOut || "") ||
        String(form.guests) !== String(query.guests || "1");

    const booking = reservation?.booking;

    const savedPreference = booking?.paymentPreference;

    const hasSavedPreference =
        PAYMENT_OPTIONS.some(
            ([value]) => value === savedPreference
        );

    const isPending =
        booking?.status === "pending_approval";

    function checkDates(event) {
        event.preventDefault();

        if (reservation) {
            return;
        }

        setError("");

        if (form.checkOut <= form.checkIn) {
            setError(
                "Check-out must be after the check-in date."
            );
            return;
        }

        setSearchParams(form);
    }

    async function submitReservation(event) {
        event.preventDefault();

        if (
            saving.current ||
            !quote ||
            !data?.availableRooms ||
            reservation
        ) {
            return;
        }

        if (datesChanged) {
            setError(
                "Check availability for your updated dates first."
            );
            return;
        }

        saving.current = true;
        setBusy(true);
        setError("");

        try {
           const response = await http.post("/public/bookings", {
    roomId: roomId,
    roomTypeId: room.roomTypeId?._id || room.roomTypeId,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: Number(query.guests || 1),
    phone: phone.trim(),
    acceptPolicies: accepted,
    expectedRate: quote.nightlyRate,
    expectedTaxRate: 0,
    requestKey: requestKey.current
});

          
const booking = response.data.booking || response.data.item;

if (!booking) {
    throw new Error(
        "Reservation submitted, but booking details were not returned."
    );
}

setReservation({
    ...response.data,
    booking,
    total:
        response.data.total ??
        response.data.invoice?.grandTotal ??
        0
});

const preference = booking.paymentPreference;

setPaymentPreference(
    PAYMENT_LABELS[preference] ? preference : ""
);

await Swal.fire({
    icon: "success",
    title: "Reservation Request Submitted!",
    html: `
        <p>Your booking request has been submitted successfully.</p>
        <p>Your reservation is waiting for Admin approval.</p>
        <p>You can track your booking from My Dashboard.</p>
    `,
    confirmButtonText: "Go to My Dashboard",
    confirmButtonColor: "#0B3037",
    allowOutsideClick: false
});

navigate("/guest/dashboard");



        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    async function savePaymentPreference(event) {
        event.preventDefault();

        if (
            savingPayment.current ||
            !reservation ||
            !paymentPreference
        ) {
            return;
        }

        savingPayment.current = true;
        setPaymentBusy(true);
        setError("");

        try {
            const currentBooking = booking._id
                ? booking
                : await findOwnBooking(booking.reference);

            const response = await http.patch(
                `/guest/bookings/${currentBooking._id}/payment-preference`,
                {
                    paymentPreference
                }
            );

            setReservation(previous => ({
                ...previous,
                booking: {
                    ...previous.booking,
                    ...response.data.item
                }
            }));
        } catch (caught) {
            if (
                caught.message ===
                "RESERVATION_LOOKUP_FAILED"
            ) {
                setError(
                    "Your reservation was submitted, but its details could not be loaded. Open My Bookings to continue. Do not create a duplicate reservation."
                );
            } else {
                setError(errorMessage(caught));
            }
        } finally {
            savingPayment.current = false;
            setPaymentBusy(false);
        }
    }

    async function refreshReservation() {
        if (savingPayment.current || !booking) {
            return;
        }

        savingPayment.current = true;
        setPaymentBusy(true);
        setError("");

        try {
            let currentBooking;

            if (booking._id) {
                const response = await http.get(
                    `/guest/bookings/${booking._id}`
                );

                currentBooking = response.data.item;
            } else {
                currentBooking = await findOwnBooking(
                    booking.reference
                );
            }

            setReservation(previous => ({
                ...previous,
                booking: {
                    ...previous.booking,
                    ...currentBooking
                }
            }));

            setPaymentPreference(
                PAYMENT_LABELS[currentBooking.paymentPreference]
                    ? currentBooking.paymentPreference
                    : ""
            );
        } catch (caught) {
            setError(
                caught.message === "RESERVATION_LOOKUP_FAILED"
                    ? "Reservation details could not be found. Open My Bookings."
                    : errorMessage(caught)
            );
        } finally {
            savingPayment.current = false;
            setPaymentBusy(false);
        }
    }

    function login() {
        const path =
            `/rooms/${roomId}?${queryString(query)}`;

        try {
            sessionStorage.setItem(
                "luxurystay_booking_return",
                path
            );
        } catch {
            setError(
                "Your browser blocked saving the selection. Log in first, then select your room and dates again."
            );
            return;
        }

        navigate("/login");
    }

    return (
        <main className="lh-page">
            <Hero title={room?.name || "Room details"}>
                {room?.hotel?.name}
            </Hero>

            <section className="lh-container lh-section">
                {!reservation && (
                    <form
                        className="lp-filters"
                        onSubmit={checkDates}
                    >
                        <label>
                            Check in
                            <input
                                required
                                type="date"
                                min={today()}
                                value={form.checkIn}
                                onChange={event =>
                                    setForm({
                                        ...form,
                                        checkIn: event.target.value
                                    })
                                }
                            />
                        </label>

                        <label>
                            Check out
                            <input
                                required
                                type="date"
                                min={form.checkIn || today()}
                                value={form.checkOut}
                                onChange={event =>
                                    setForm({
                                        ...form,
                                        checkOut: event.target.value
                                    })
                                }
                            />
                        </label>

                        <label>
                            Guests
                            <input
                                required
                                type="number"
                                min="1"
                                max={room?.capacity || 20}
                                value={form.guests}
                                onChange={event =>
                                    setForm({
                                        ...form,
                                        guests: event.target.value
                                    })
                                }
                            />
                        </label>

                        <button className="lh-button">
                            Check availability
                        </button>
                    </form>
                )}

                <State {...result} retry={result.reload} />

                {room && (
                    <>
                        <div className="lh-detail-layout">
                            <div>
                                <Gallery
                                    images={
                                        room.images?.length
                                            ? room.images
                                            : room.hotel.images
                                    }
                                    title={room.name}
                                />

                                <div className="lh-panel">
                                    <h2>{room.name}</h2>

                                    <p>
                                        Up to {room.capacity} guests
                                        {" · "}
                                        {money(room.baseRate)}
                                        {" per night before tax"}
                                    </p>

                                    <Link
                                        to={`/hotels/${room.hotel._id}`}
                                    >
                                        {room.hotel.name}
                                        {" · "}
                                        {room.hotel.location}
                                    </Link>

                                    <ul className="lh-amenities">
                                        {room.amenities?.map(item => (
                                            <li key={item}>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <aside className="lh-planner">
                                <h2>Your stay</h2>

                                {reservation ? (
                                    <div className="lh-panel">
                                        <div role="status">
                                            <h3>
                                                {isPending
                                                    ? "Reservation submitted"
                                                    : `Reservation ${statusLabel(booking.status).toLowerCase()}`}
                                            </h3>

                                            <p>
                                                Reference:{" "}
                                                <strong>
                                                    {booking.reference}
                                                </strong>
                                            </p>

                                            <p>
                                               {String(booking.checkIn || "").slice(0, 10)}
{" to "}
{String(booking.checkOut || "").slice(0, 10)}
                                            </p>

                                            <p>
                                                Reservation status:{" "}
                                                <strong>
                                                    {statusLabel(booking.status)}
                                                </strong>
                                            </p>

                                            {![
                                                "rejected",
                                                "cancelled"
                                            ].includes(booking.status) && (
                                                <p>
                                                    Reservation total:{" "}
                                                    <strong>
                                                        {money(reservation.total)}
                                                    </strong>
                                                </p>
                                            )}

                                            {isPending && (
                                                <p>
                                                    Payment is pending.
                                                    Select a payment option
                                                    below. The hotel Admin
                                                    or Manager will review
                                                    your reservation.
                                                </p>
                                            )}

                                            {booking.status === "confirmed" && (
                                                <p className="lh-success">
                                                    Your reservation has
                                                    been approved and
                                                    confirmed. Check your
                                                    invoice for the current
                                                    payment balance.
                                                </p>
                                            )}

                                            {booking.status === "rejected" && (
                                                <p className="lh-notice">
                                                    This reservation was
                                                    rejected. No amount is
                                                    due for this rejected
                                                    request.
                                                    {" "}
                                                    {booking.approval
                                                        ?.rejectionReason}
                                                </p>
                                            )}

                                            {booking.status === "cancelled" && (
                                                <p className="lh-notice">
                                                    This reservation has
                                                    been cancelled. See
                                                    My Invoices for its
                                                    billing details.
                                                </p>
                                            )}
                                        </div>

                                        {isPending && (
                                            <form
                                                onSubmit={
                                                    savePaymentPreference
                                                }
                                            >
                                                <fieldset
                                                    disabled={paymentBusy}
                                                >
                                                    <legend>
                                                        Payment option
                                                    </legend>

                                                    {PAYMENT_OPTIONS.map(
                                                        ([value, label]) => (
                                                            <label
                                                                className="lp-check"
                                                                key={value}
                                                            >
                                                                <input
                                                                    required
                                                                    type="radio"
                                                                    name="paymentPreference"
                                                                    value={value}
                                                                    checked={
                                                                        paymentPreference ===
                                                                        value
                                                                    }
                                                                    onChange={
                                                                        event =>
                                                                            setPaymentPreference(
                                                                                event.target.value
                                                                            )
                                                                    }
                                                                />

                                                                <span>
                                                                    {label}
                                                                </span>
                                                            </label>
                                                        )
                                                    )}

                                                    {paymentPreference ===
                                                        "cash" && (
                                                        <p className="lh-preview">
                                                            Pay at the hotel.
                                                            Reception staff
                                                            will record your
                                                            payment after
                                                            receiving it.
                                                        </p>
                                                    )}

                                                    {paymentPreference &&
                                                        paymentPreference !==
                                                            "cash" && (
                                                        <p className="lh-notice">
                                                            Demo online
                                                            payment option.
                                                            No money will
                                                            be charged.
                                                            Do not enter
                                                            real card
                                                            details, PIN
                                                            or OTP.
                                                            Payment remains
                                                            pending for
                                                            staff review.
                                                        </p>
                                                    )}

                                                    <button
                                                        className="lh-button lh-full"
                                                        disabled={
                                                            paymentBusy ||
                                                            !paymentPreference
                                                        }
                                                    >
                                                        {paymentBusy
                                                            ? "Saving…"
                                                            : hasSavedPreference
                                                                ? "Update payment option"
                                                                : "Save payment option"}
                                                    </button>
                                                </fieldset>
                                            </form>
                                        )}

                                        {hasSavedPreference && (
                                            <p role="status">
                                                Selected payment option:{" "}
                                                <strong>
                                                    {
                                                        PAYMENT_LABELS[
                                                            savedPreference
                                                        ]
                                                    }
                                                </strong>
                                            </p>
                                        )}

                                        <div className="lh-panel">
                                            <button
                                                type="button"
                                                className="lh-button"
                                                disabled={paymentBusy}
                                                onClick={refreshReservation}
                                            >
                                                {paymentBusy
                                                    ? "Please wait…"
                                                    : "Refresh approval status"}
                                            </button>

                                            <p>
                                                <Link
                                                    to={
                                                        booking._id
                                                            ? `/guest/bookings/${booking._id}`
                                                            : "/guest/bookings"
                                                    }
                                                >
                                                    View my reservation
                                                </Link>
                                            </p>

                                            <p>
                                                <Link to="/guest/invoices">
                                                    View my invoices
                                                </Link>
                                            </p>

                                            <p>
                                                <Link to="/guest/notifications">
                                                    View notifications
                                                </Link>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {datesChanged && (
                                            <p className="lh-notice">
                                                Click Check availability
                                                to update your estimate.
                                            </p>
                                        )}

                                        {quote ? (
                                            <>
                                                <p>
                                                    {quote.nights} night(s)
                                                    {" × "}
                                                    {money(
                                                        quote.nightlyRate
                                                    )}
                                                </p>

                                                <dl className="lp-summary">
                                                    <div>
                                                        <dt>
                                                            Room subtotal
                                                        </dt>
                                                        <dd>
                                                            {money(
                                                                quote.subtotal
                                                            )}
                                                        </dd>
                                                    </div>

                                                    <div>
                                                        <dt>
                                                            Tax (
                                                            {quote.taxRate}
                                                            %)
                                                        </dt>
                                                        <dd>
                                                            {money(quote.tax)}
                                                        </dd>
                                                    </div>

                                                    <div>
                                                        <dt>
                                                            Reservation total
                                                        </dt>
                                                        <dd>
                                                            {money(
                                                                quote.grandTotal
                                                            )}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                <p>
                                                    {data.availableRooms}
                                                    {" room(s) available."}
                                                </p>

                                                <p className="lh-preview">
                                                    Additional services
                                                    are billed separately.
                                                    After submitting,
                                                    choose your payment
                                                    option and wait for
                                                    hotel approval.
                                                </p>
                                            </>
                                        ) : (
                                            <p>
                                                Select dates and guest
                                                count to see availability
                                                and a price estimate.
                                            </p>
                                        )}

                                        {quote &&
                                            data.availableRooms > 0 &&
                                            !authLoading && (
                                                user?.role === "Guest" ? (
                                                    <form
                                                        onSubmit={
                                                            submitReservation
                                                        }
                                                    >
                                                        <label>
                                                            Contact phone
                                                            <input
                                                                required
                                                                type="tel"
                                                                maxLength={30}
                                                                value={phone}
                                                                onChange={
                                                                    event =>
                                                                        setPhone(
                                                                            event.target.value
                                                                        )
                                                                }
                                                            />
                                                        </label>

                                                        <label className="lp-check">
                                                            <input
                                                                required
                                                                type="checkbox"
                                                                checked={
                                                                    accepted
                                                                }
                                                                onChange={
                                                                    event =>
                                                                        setAccepted(
                                                                            event.target.checked
                                                                        )
                                                                }
                                                            />

                                                            <span>
                                                                I have
                                                                reviewed
                                                                and accept
                                                                the hotel
                                                                policies.
                                                            </span>
                                                        </label>

                                                        <button
                                                            className="lh-button lh-full"
                                                            disabled={
                                                                busy ||
                                                                !accepted ||
                                                                datesChanged
                                                            }
                                                        >
                                                            {busy
                                                                ? "Submitting…"
                                                                : "Submit reservation"}
                                                        </button>
                                                    </form>
                                                ) : user ? (
                                                    <p className="lh-notice">
                                                        Online reservations
                                                        require a Guest
                                                        account. Use your
                                                        staff panel for
                                                        operational bookings.
                                                    </p>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="lh-button lh-full"
                                                        onClick={login}
                                                    >
                                                        Log in / register
                                                        to book
                                                    </button>
                                                )
                                            )}
                                    </>
                                )}

                                {error && (
                                    <div
                                        className="lh-error"
                                        role="alert"
                                    >
                                        <p>{error}</p>
                                    </div>
                                )}
                            </aside>
                        </div>

                        <Policies policy={data.policy} />
                    </>
                )}
            </section>
        </main>
    );
}