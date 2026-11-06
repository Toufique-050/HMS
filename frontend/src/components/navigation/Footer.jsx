
import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="lux-footer">
            <div className="lux-container">

                <div className="lux-footer-main">

                    <div className="lux-footer-brand">
                        <Link to="/" className="lux-brand lux-footer-logo">
                            <span className="lux-brand-mark">L</span>
                            <span className="lux-brand-text">
                                <strong>LuxuryStay</strong>
                                <small>HOTELS & RESORTS</small>
                            </span>
                        </Link>

                        <p>
                            Discover beautiful destinations, exceptional
                            hospitality and unforgettable hotel experiences.
                        </p>
                    </div>

                    <div className="lux-footer-column">
                        <h3>Explore</h3>
                        <Link to="/">Home</Link>
                        <Link to="/hotels">Our Hotels</Link>
                        <Link to="/rooms">Rooms & Suites</Link>
                        <Link to="/about">About Us</Link>
                    </div>

                    <div className="lux-footer-column">
                        <h3>Quick Links</h3>
                        <Link to="/contact">Contact Us</Link>
                        <Link to="/login">Guest Login</Link>
                        <Link to="/register">Register</Link>
                    </div>

                    <div className="lux-footer-column lux-footer-contact">
                        <h3>Get in Touch</h3>
                        <p>Need help with your booking?</p>
                        <Link to="/contact" className="lux-footer-contact-link">
                            Contact Our Team ↗
                        </Link>
                    </div>

                </div>

                <div className="lux-footer-bottom">
                    <p>
                        © {new Date().getFullYear()} LuxuryStay. All rights reserved.
                    </p>

                    <div>
                        <Link to="/privacy-policy">Privacy Policy</Link>
                        <Link to="/terms">Terms & Conditions</Link>
                    </div>
                </div>

            </div>
        </footer>
    );
}
