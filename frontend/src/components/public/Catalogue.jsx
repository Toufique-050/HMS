import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import usePublic from "../../hooks/usePublic.js";
import "../../styles/publicLive.css";

export const money = value =>
    `Rs. ${new Intl.NumberFormat("en-PK", {
        maximumFractionDigits: 2
    }).format(value)}`;

export const today = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());

export function queryString(values) {
    const query = new URLSearchParams();

    Object.entries(values).forEach(([key, value]) => {
        if (value !== "" && value != null) {
            query.set(key, String(value));
        }
    });

    return query.toString();
}

export function Photo({ src, alt }) {
    const [failed, setFailed] = useState(false);

    return (
        <div className="lh-photo">
            <span aria-hidden="true">LuxuryStay</span>

            {src && !failed && (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            )}
        </div>
    );
}

export function Gallery({ images = [], title }) {
    const [index, setIndex] = useState(0);

    const current = Math.min(
        index,
        Math.max(0, images.length - 1)
    );

    return (
        <div className="lh-room-gallery">
            <Photo
                key={images[current] || "empty"}
                src={images[current]}
                alt={title}
            />

            {images.length > 1 && (
                <div className="lh-gallery-controls">
                    <button
                        type="button"
                        aria-label="Previous photo"
                        onClick={() => setIndex(
                            (current - 1 + images.length) %
                            images.length
                        )}
                    >
                        ←
                    </button>

                    <span>
                        {current + 1} / {images.length}
                    </span>

                    <button
                        type="button"
                        aria-label="Next photo"
                        onClick={() => setIndex(
                            (current + 1) % images.length
                        )}
                    >
                        →
                    </button>
                </div>
            )}
        </div>
    );
}

export function Hero({ title, children }) {
    return (
        <header className="lh-page-hero">
            <div className="lh-container">
                <div className="lh-breadcrumb">
                    <Link to="/">Home</Link> / {title}
                </div>

                <span className="lh-eyebrow">
                    LUXURYSTAY HOSPITALITY
                </span>

                <h1>{title}</h1>

                {children && <p>{children}</p>}
            </div>
        </header>
    );
}

export function State({ loading, error, retry }) {
    if (loading) {
        return (
            <p className="lh-notice" role="status">
                Loading…
            </p>
        );
    }

    if (!error) return null;

    return (
        <div className="lh-error" role="alert">
            <p>{error}</p>
            <button
                type="button"
                className="lh-button"
                onClick={retry}
            >
                Retry
            </button>
        </div>
    );
}

export function RoomCard({ room, search = {} }) {
    return (
        <article className="lh-room">
            <Photo
                src={
                    room.images?.[0] ||
                    room.hotel?.images?.[0]
                }
                alt={room.name}
            />

            <div className="lh-room-body">
                <div className="lh-meta">
                    <span>{room.hotel?.name}</span>
                    <span>Up to {room.capacity} guests</span>
                </div>

                <h2>{room.name}</h2>

                <div className="lh-chips">
                    {room.amenities?.slice(0, 4).map(item => (
                        <span key={item}>{item}</span>
                    ))}
                </div>

                <div className="lh-price-row">
                    <div>
                        <small>Per night · before tax</small>
                        <strong>{money(room.baseRate)}</strong>
                    </div>

                    <Link
                        to={
                            `/rooms/${room._id}?` +
                            queryString(search)
                        }
                    >
                        View room →
                    </Link>
                </div>
            </div>
        </article>
    );
}

export function HotelCard({ hotel }) {
    return (
        <article className="lh-hotel">
            <div className="lh-hotel-image">
                <Photo
                    src={hotel.images?.[0]}
                    alt={hotel.name}
                />
            </div>

            <div className="lh-hotel-body">
                <span className="lh-eyebrow">
                    {hotel.location}
                </span>

                <h2>{hotel.name}</h2>

                <p>
                    {hotel.address ||
                        "Explore this hotel's rooms and facilities."}
                </p>

                <div className="lh-chips">
                    {hotel.facilities?.slice(0, 5).map(item => (
                        <span key={item}>{item}</span>
                    ))}
                </div>

                <div className="lh-hotel-bottom">
                    <div>
                        <small>
                            Nightly rates from · before tax
                        </small>

                        <strong>
                            {hotel.fromRate == null
                                ? "Contact hotel"
                                : money(hotel.fromRate)}
                        </strong>
                    </div>

                    <Link
                        className="lh-button"
                        to={`/hotels/${hotel._id}`}
                    >
                        Explore hotel →
                    </Link>
                </div>
            </div>
        </article>
    );
}

export function SearchForm({
    initial = {},
    fixedHotel = ""
}) {
    const hotels = usePublic("/hotels");
    const hotelList = Array.isArray(hotels.data?.hotels)
    ? hotels.data.hotels
    : [];
    const navigate = useNavigate();

    const [form, setForm] = useState({
        hotelId: fixedHotel || initial.hotelId || "",
        checkIn: initial.checkIn || "",
        checkOut: initial.checkOut || "",
        guests: initial.guests || "1"
    });

    const [error, setError] = useState("");

    function change(event) {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });

        setError("");
    }

    function submit(event) {
        event.preventDefault();

        const invalid =
            !!form.checkIn !== !!form.checkOut ||
            (
                form.checkIn &&
                (
                    form.checkIn < today() ||
                    form.checkOut <= form.checkIn ||
                    (
                        Date.parse(form.checkOut) -
                        Date.parse(form.checkIn)
                    ) / 86400000 > 365
                )
            );

        if (invalid) {
            setError(
                "Choose both valid dates: checkout must be later, with a stay of up to 365 nights."
            );
            return;
        }

        navigate(`/rooms?${queryString(form)}`);
    }

    return (
        <>
            <form className="lh-search" onSubmit={submit}>
                <label>
                    Hotel
                    <select
                        name="hotelId"
                        value={form.hotelId}
                        disabled={!!fixedHotel || hotels.loading}
                        onChange={change}
                    >
                        <option value="">All hotels</option>

                       {hotelList.map(hotel => (
    <option
        key={hotel._id}
        value={hotel._id}
    >
        {hotel.hotelName || hotel.name}
    </option>
))}
                    </select>
                </label>

                <label>
                    Check in
                    <input
                        name="checkIn"
                        type="date"
                        min={today()}
                        value={form.checkIn}
                        onChange={change}
                    />
                </label>

                <label>
                    Check out
                    <input
                        name="checkOut"
                        type="date"
                        min={form.checkIn || today()}
                        value={form.checkOut}
                        onChange={change}
                    />
                </label>

                <label>
                    Guests
                    <input
                        name="guests"
                        type="number"
                        required
                        min="1"
                        max="20"
                        value={form.guests}
                        onChange={change}
                    />
                </label>

                <button className="lh-button">
                    Search rooms
                </button>
            </form>

            {(error || hotels.error) && (
                <p className="lh-error" role="alert">
                    {error || hotels.error}
                </p>
            )}
        </>
    );
}

export function Policies({ policy }) {
    return (
        <div className="lh-panel">
            <h2>Hotel policies</h2>

            <p>
                Check in: {policy?.checkInTime || "Confirm with hotel"}
                {" · "}
                Check out: {policy?.checkOutTime || "Confirm with hotel"}
            </p>

            <h3>Cancellation</h3>
            <p className="lp-text">
                {policy?.cancellationPolicy ||
                    "Contact the hotel for its cancellation policy before booking."}
            </p>

            <h3>Privacy</h3>
            <p className="lp-text">
                {policy?.privacyPolicy ||
                    "Contact the hotel for its privacy policy before sharing personal information."}
            </p>
        </div>
    );
}