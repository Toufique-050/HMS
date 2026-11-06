
import { Link } from "react-router-dom";

import usePublic from "../../hooks/usePublic.js";

import {
    Photo,
    RoomCard,
    SearchForm,
    State
} from "../../components/public/Catalogue.jsx";

import "../../styles/HomePage.css";

export default function HomePage() {
    const {
        data: hotelData,
        loading: hotelsLoading,
        error: hotelsError,
        reload: reloadHotels
    } = usePublic("/hotels");

    const {
        data: roomData,
        loading: roomsLoading,
        error: roomsError,
        reload: reloadRooms
    } = usePublic("/rooms", { limit: 3 });

    const hotelItems = hotelData?.hotels || [];
    const roomItems = roomData?.items || [];

    const firstHotel = hotelItems[0];

    const heroImage =
        firstHotel?.images?.[0] || "/images/hotel1.jpg";

    const hotelState = {
        loading: hotelsLoading,
        error: hotelsError,
        data: hotelData
    };

    const roomState = {
        loading: roomsLoading,
        error: roomsError,
        data: roomData
    };

    return (
        <main className="lux-home">

            {/* HERO */}
            <section className="lux-hero">
                <div className="lux-hero-background">
                    <Photo
                        key={heroImage}
                        src={heroImage}
                        alt={firstHotel?.name || "LuxuryStay hotel"}
                    />
                </div>

                <div className="lux-hero-overlay" />

                <div className="lux-hero-content">
                    <span className="lux-hero-eyebrow">
                        WELCOME TO LUXURYSTAY
                    </span>

                    <h1>Unique Experience</h1>

                    <div className="lux-hero-divider">
                        <span />
                        <strong>ENJOY WITH US</strong>
                        <span />
                    </div>

                    <p>
                        Discover elegant spaces, thoughtful comfort
                        and hospitality designed to make every stay
                        memorable.
                    </p>

                    <div className="lux-hero-buttons">
                        <Link to="/hotels" className="lux-gold-button">
                            Explore Hotels <span>↗</span>
                        </Link>

                        <Link to="/rooms" className="lux-outline-button">
                            Discover Rooms <span>→</span>
                        </Link>
                    </div>
                </div>

                <div className="lux-hero-bottom">
                    <div>
                        <span>FEATURED PROPERTY</span>
                        <strong>{firstHotel?.name || "LuxuryStay"}</strong>
                    </div>

                    <div>
                        <span>LOCATION</span>
                        <strong>
                            {firstHotel?.location ||
                                "Premium hospitality destination"}
                        </strong>
                    </div>

                    <div className="lux-scroll-indicator">
                        <span />
                        SCROLL TO EXPLORE
                    </div>
                </div>
            </section>

            {/* SEARCH */}
            <section className="lux-search-section">
                <div className="lux-container">
                    <div className="lux-search-card">
                        <div className="lux-search-heading">
                            <span>PLAN YOUR STAY</span>
                            <h2>Find Your Perfect Room</h2>
                            <p>
                                Select your hotel, dates and guests
                                to explore available rooms.
                            </p>
                        </div>

                        <SearchForm />
                    </div>
                </div>
            </section>

            {/* INTRODUCTION */}
            <section className="lux-intro lux-container">
                <div className="lux-intro-heading">
                    <span className="lux-kicker">
                        THE LUXURYSTAY EXPERIENCE
                    </span>

                    <h2>
                        More than a room.
                        <br />
                        <em>A memorable stay.</em>
                    </h2>
                </div>

                <div className="lux-intro-content">
                    <p>
                        At LuxuryStay, every detail is designed to
                        give you a comfortable and welcoming experience.
                        From beautifully prepared rooms to thoughtful
                        hospitality, your stay is our priority.
                    </p>

                    <Link to="/about" className="lux-under-link">
                        Discover our story <span>→</span>
                    </Link>
                </div>
            </section>

            {/* FEATURED HOTELS */}
            <section className="lux-hotels">
                <div className="lux-container">
                    <div className="lux-section-heading lux-hotels-heading">
                        <div>
                            <span className="lux-kicker">
                                DISCOVER OUR PROPERTIES
                            </span>

                            <h2>Our Featured Hotels</h2>

                            <div className="lux-heading-decoration">
                                <span />
                                <b>✦</b>
                                <span />
                            </div>

                            <p>
                                Discover welcoming destinations, beautiful
                                surroundings and comfortable stays for your
                                next journey.
                            </p>
                        </div>

                        <Link to="/hotels" className="lux-view-all">
                            Explore All Hotels <span>→</span>
                        </Link>
                    </div>

                    <State
                        {...hotelState}
                        retry={reloadHotels}
                    />

                    {hotelItems.length > 0 && (
                        <div className="lux-hotel-grid">
                            {hotelItems.slice(0, 3).map((hotel, index) => (
                                <article
                                    className="lux-hotel-card"
                                    key={hotel._id || hotel.id || index}
                                >
                                    <Link
                                        to="/hotels"
                                        className="lux-hotel-image"
                                        aria-label={`Explore ${hotel.name || "hotel"}`}
                                    >
                                        <Photo
                                            src={
                                                hotel.images?.[0] ||
                                                "/images/hotel1.jpg"
                                            }
                                            alt={
                                                hotel.name || "LuxuryStay hotel"
                                            }
                                        />

                                        <span className="lux-hotel-number">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                    </Link>

                                    <div className="lux-hotel-card-content">
                                        <span className="lux-hotel-label">
                                            <span>✦</span> LUXURYSTAY COLLECTION
                                        </span>

                                        <h3>
                                            {hotel.name || "Luxury Hotel"}
                                        </h3>

                                        <p className="lux-hotel-location">
                                            <span>⌖</span>
                                            {hotel.location ||
                                                "Premium destination"}
                                        </p>

                                        <div className="lux-hotel-card-footer">
                                            <span>
                                                Discover your next stay
                                            </span>

                                            <Link
                                                to="/hotels"
                                                className="lux-hotel-arrow"
                                                aria-label="View all hotels"
                                            >
                                                ↗
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    {!hotelsLoading &&
                        !hotelsError &&
                        hotelItems.length === 0 && (
                            <p className="lux-hotel-empty">
                                No hotels are currently listed.
                                Please check again later.
                            </p>
                        )}

                    <div className="lux-hotels-bottom">
                        <span />
                        <p>Find a place that feels like yours.</p>
                        <span />
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="lux-features">
                <div className="lux-container lux-feature-grid">
                    <article className="lux-feature-card">
                        <span className="lux-feature-number">01</span>
                        <div className="lux-feature-icon">◇</div>
                        <h3>Thoughtful Comfort</h3>
                        <p>
                            Relax in carefully prepared spaces
                            created around your comfort.
                        </p>
                    </article>

                    <article className="lux-feature-card">
                        <span className="lux-feature-number">02</span>
                        <div className="lux-feature-icon">⌖</div>
                        <h3>Exceptional Locations</h3>
                        <p>
                            Explore our properties and choose
                            a location that fits your journey.
                        </p>
                    </article>

                    <article className="lux-feature-card">
                        <span className="lux-feature-number">03</span>
                        <div className="lux-feature-icon">✦</div>
                        <h3>Personal Hospitality</h3>
                        <p>
                            Enjoy a simple reservation experience
                            backed by thoughtful service.
                        </p>
                    </article>

                    <article className="lux-feature-card">
                        <span className="lux-feature-number">04</span>
                        <div className="lux-feature-icon">✓</div>
                        <h3>Easy Booking</h3>
                        <p>
                            Search, compare and submit your stay
                            request in only a few simple steps.
                        </p>
                    </article>
                </div>
            </section>

            {/* ROOMS */}
            <section className="lux-rooms">
                <div className="lux-container">
                    <div className="lux-section-heading">
                        <div>
                            <span className="lux-kicker">
                                FIND YOUR COMFORT
                            </span>

                            <h2>Our Rooms</h2>

                            <div className="lux-heading-decoration">
                                <span />
                                <b>✦</b>
                                <span />
                            </div>

                            <p>
                                Carefully selected spaces for business,
                                leisure and everything in between.
                            </p>
                        </div>

                        <Link to="/rooms" className="lux-view-all">
                            View All Rooms <span>→</span>
                        </Link>
                    </div>

                    <State
                        {...roomState}
                        retry={reloadRooms}
                    />

                    {roomItems.length > 0 && (
                        <div className="lh-room-grid lux-room-grid">
                            {roomItems.map((room, index) => (
                                <RoomCard
                                    key={room._id || room.id || index}
                                    room={room}
                                />
                            ))}
                        </div>
                    )}

                    {!roomsLoading &&
                        !roomsError &&
                        roomItems.length === 0 && (
                            <p className="lh-notice">
                                No rooms are currently listed.
                                Please contact the hotel.
                            </p>
                        )}
                </div>
            </section>

            {/* EXPERIENCE STRIP */}
            <section className="lux-experience">
                <div className="lux-experience-overlay" />

                <div className="lux-container lux-experience-inner">
                    <div>
                        <span className="lux-kicker">
                            YOUR STAY, YOUR WAY
                        </span>

                        <h2>
                            Designed for
                            <br />
                            <em>memorable moments.</em>
                        </h2>
                    </div>

                    <div className="lux-experience-text">
                        <p>
                            Whether you are travelling for business,
                            spending time with family or simply
                            escaping the routine, LuxuryStay gives
                            you a place to slow down and enjoy.
                        </p>

                        <Link to="/hotels" className="lux-gold-button">
                            Explore Hotels <span>↗</span>
                        </Link>
                    </div>
                </div>
            </section>

            {/* WHY LUXURYSTAY */}
            <section className="lux-why">
                <div className="lux-container">
                    <div className="lux-section-heading lux-why-heading">
                        <div>
                            <span className="lux-kicker">
                                WHY LUXURYSTAY
                            </span>

                            <h2>Hospitality with purpose.</h2>
                        </div>
                    </div>

                    <div className="lux-stat-grid">
                        <div>
                            <strong>24/7</strong>
                            <span>Guest Support</span>
                        </div>

                        <div>
                            <strong>100%</strong>
                            <span>Comfort Focused</span>
                        </div>

                        <div>
                            <strong>Easy</strong>
                            <span>Reservation</span>
                        </div>

                        <div>
                            <strong>5★</strong>
                            <span>Inspired Experience</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="lux-final-cta">
                <div className="lux-final-cta-decoration" />

                <div className="lux-container lux-final-content">
                    <span className="lux-kicker">
                        START YOUR JOURNEY
                    </span>

                    <h2>
                        Your next stay
                        <br />
                        starts here.
                    </h2>

                    <p>
                        Explore our hotels and discover a room
                        made for your next memorable journey.
                    </p>

                    <div className="lux-final-buttons">
                        <Link to="/hotels" className="lux-gold-button">
                            Browse Hotels <span>↗</span>
                        </Link>

                        <Link to="/rooms" className="lux-outline-button">
                            View Rooms <span>→</span>
                        </Link>
                    </div>
                </div>
            </section>

        </main>
    );
}
