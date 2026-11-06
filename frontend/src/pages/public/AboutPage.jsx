
import { Link } from "react-router-dom";
import { Hero } from "../../components/public/Catalogue.jsx";
import "../../styles/AboutPage.css";

const hotelImages = {
    lobby: "/images/image1.jpeg",
    room: "/images/image2.jpeg",
    comfort: "/images/image3.jpeg"
};

export default function AboutPage() {
    return (
        <main className="lux-about">

            <section className="lux-about-hero">
                <div className="lux-about-hero-image">
                    <img
                        src={hotelImages.lobby}
                        alt="Elegant LuxuryStay hotel interior"
                    />
                </div>

                <div className="lux-about-hero-overlay" />

                <div className="lux-about-hero-content">
                    <span className="lux-about-kicker">
                        THE LUXURYSTAY EXPERIENCE
                    </span>

                    <h1>
                        Hospitality that
                        <br />
                        <em>feels like home.</em>
                    </h1>

                    <p>
                        Discover thoughtfully selected hotels,
                        comfortable rooms and a more personal
                        way to plan your next stay.
                    </p>

                    <div className="lux-about-actions">
                        <Link
                            to="/hotels"
                            className="lux-about-primary-button"
                        >
                            Explore Our Hotels <span>↗</span>
                        </Link>

                        <Link
                            to="/rooms"
                            className="lux-about-text-button"
                        >
                            Discover Rooms →
                        </Link>
                    </div>
                </div>

                <div className="lux-about-hero-caption">
                    <span>COMFORT · CARE · EXPERIENCE</span>
                    <span>YOUR JOURNEY STARTS HERE</span>
                </div>
            </section>

            <section className="lux-about-intro lux-about-container">
                <div className="lux-about-intro-title">
                    <span className="lux-about-kicker">
                        WHO WE ARE
                    </span>

                    <h2>
                        More than a booking.
                        <br />
                        <em>A better stay.</em>
                    </h2>

                    <div className="lux-about-decoration">
                        <span />
                        <b>✦</b>
                        <span />
                    </div>
                </div>

                <div className="lux-about-intro-copy">
                    <p>
                        LuxuryStay brings hotel information,
                        room options and stay details together
                        in one convenient place. We make it easier
                        to explore properties and find a stay
                        that suits your plans.
                    </p>

                    <p>
                        From checking room facilities to reviewing
                        hotel policies, our goal is to help you
                        make informed choices before submitting
                        your reservation request.
                    </p>

                    <Link to="/hotels" className="lux-about-underlink">
                        Find your next destination <span>→</span>
                    </Link>
                </div>
            </section>

            <section className="lux-about-story">
                <div className="lux-about-container lux-about-story-grid">
                    <div className="lux-about-story-image">
                        <img
                            src={hotelImages.room}
                            alt="Comfortable hotel room prepared for guests"
                            loading="lazy"
                        />

                        <div className="lux-about-image-note">
                            <span>YOUR COMFORT</span>
                            <strong>Our priority.</strong>
                        </div>
                    </div>

                    <div className="lux-about-story-content">
                        <span className="lux-about-kicker">
                            A THOUGHTFUL WAY TO STAY
                        </span>

                        <h2>
                            Every journey deserves
                            <br />
                            <em>a welcoming place.</em>
                        </h2>

                        <p>
                            Choosing a hotel should feel simple.
                            LuxuryStay helps you explore available
                            properties, compare room information
                            and understand the details that matter
                            when planning your visit.
                        </p>

                        <div className="lux-about-benefit">
                            <span>01</span>
                            <div>
                                <h3>Explore with confidence</h3>
                                <p>
                                    Review published hotel information
                                    and locations before choosing.
                                </p>
                            </div>
                        </div>

                        <div className="lux-about-benefit">
                            <span>02</span>
                            <div>
                                <h3>Choose your comfort</h3>
                                <p>
                                    Check room capacity, rates
                                    and listed amenities.
                                </p>
                            </div>
                        </div>

                        <div className="lux-about-benefit">
                            <span>03</span>
                            <div>
                                <h3>Plan with clarity</h3>
                                <p>
                                    Review relevant policies and
                                    reservation details before booking.
                                </p>
                            </div>
                        </div>

                        <Link
                            to="/policies"
                            className="lux-about-primary-button"
                        >
                            Read Our Policies <span>→</span>
                        </Link>
                    </div>
                </div>
            </section>

            <section className="lux-about-values">
                <div className="lux-about-container">
                    <div className="lux-about-section-heading">
                        <span className="lux-about-kicker">
                            THE DETAILS THAT MATTER
                        </span>

                        <h2>What makes a stay special?</h2>

                        <p>
                            A thoughtful experience begins with
                            clear information and the freedom
                            to choose what suits you.
                        </p>
                    </div>

                    <div className="lux-about-value-grid">
                        <article className="lux-about-value-card">
                            <span className="lux-about-value-number">
                                01
                            </span>
                            <div className="lux-about-value-icon">◇</div>
                            <h3>Thoughtful Comfort</h3>
                            <p>
                                Find room options and facilities
                                suited to your travel needs.
                            </p>
                        </article>

                        <article className="lux-about-value-card">
                            <span className="lux-about-value-number">
                                02
                            </span>
                            <div className="lux-about-value-icon">⌖</div>
                            <h3>Explore Locations</h3>
                            <p>
                                Discover listed hotel destinations
                                and choose where you would like to stay.
                            </p>
                        </article>

                        <article className="lux-about-value-card">
                            <span className="lux-about-value-number">
                                03
                            </span>
                            <div className="lux-about-value-icon">✦</div>
                            <h3>Clear Information</h3>
                            <p>
                                Review rates, amenities and policies
                                before submitting a reservation.
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            <section className="lux-about-visual">
                <div className="lux-about-visual-image">
                    <img
                        src={hotelImages.comfort}
                        alt="Inviting hotel accommodation"
                        loading="lazy"
                    />
                </div>

                <div className="lux-about-visual-overlay" />

                <div className="lux-about-container lux-about-visual-content">
                    <span className="lux-about-kicker">
                        YOUR STAY, YOUR WAY
                    </span>

                    <h2>
                        Make room for
                        <br />
                        <em>memorable moments.</em>
                    </h2>

                    <p>
                        Whether travelling for business, enjoying
                        time with family or taking a break, begin
                        your search for a place that feels right.
                    </p>

                    <Link
                        to="/hotels"
                        className="lux-about-primary-button"
                    >
                        Start Exploring <span>↗</span>
                    </Link>
                </div>
            </section>

            <section className="lux-about-contact lux-about-container">
                <div>
                    <span className="lux-about-kicker">
                        WE ARE HERE TO HELP
                    </span>

                    <h2>Ready to plan your next stay?</h2>

                    <p>
                        Explore our listed properties or contact
                        us if you need help finding hotel information.
                    </p>
                </div>

                <Link to="/contact" className="lux-about-contact-button">
                    Contact Us <span>→</span>
                </Link>
            </section>

        </main>
    );
}
