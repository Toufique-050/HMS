
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user } = useAuth();

    const closeMenu = () => setMenuOpen(false);

    const isGuest = user?.role === "Guest";

    return (
        <>
            <div className="lux-topbar">
                <div className="lux-container lux-topbar-inner">
                    <span>Welcome to LuxuryStay</span>
                    <span>Luxury · Comfort · Hospitality</span>
                </div>
            </div>

            <header className="lux-header">
                <div className="lux-container lux-header-inner">

                    <Link
                        to="/"
                        className="lux-brand"
                        onClick={closeMenu}
                    >
                        <span className="lux-brand-mark">L</span>

                        <span className="lux-brand-text">
                            <strong>LuxuryStay</strong>
                            <small>HOTELS & RESORTS</small>
                        </span>
                    </Link>

                    <button
                        className={`lux-menu-button ${menuOpen ? "active" : ""}`}
                        type="button"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle navigation"
                        aria-expanded={menuOpen}
                        aria-controls="lux-navigation"
                    >
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>

                    <nav
                        id="lux-navigation"
                        className={`lux-navigation ${menuOpen ? "is-open" : ""}`}
                    >
                        <div className="lux-nav-links">
                            <NavLink to="/" end onClick={closeMenu}>
                                Home
                            </NavLink>

                            <NavLink to="/about" onClick={closeMenu}>
                                About
                            </NavLink>

                            <NavLink to="/contact" onClick={closeMenu}>
                                Contact
                            </NavLink>

                            <NavLink to="/rooms" onClick={closeMenu}>
                                Rooms
                            </NavLink>

                            <NavLink to="/hotels" onClick={closeMenu}>
                                Hotels
                            </NavLink>
                        </div>

                        <div className="lux-nav-account">

                            {isGuest ? (
                                <Link
                                    to="/guest/dashboard"
                                    className="lux-book-button"
                                    onClick={closeMenu}
                                >
                                    My Dashboard ↗
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="lux-login-link"
                                        onClick={closeMenu}
                                    >
                                        Log In
                                    </Link>

                                    <Link
                                        to="/hotels"
                                        className="lux-book-button"
                                        onClick={closeMenu}
                                    >
                                        Book Your Stay ↗
                                    </Link>
                                </>
                            )}

                        </div>
                    </nav>

                </div>
            </header>
        </>
    );
}
