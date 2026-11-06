import { Link } from "react-router-dom";

export default function NewBookingPage() {
    return (
        <>
            <header className="gs-hero">
                <div>
                    <span className="gs-eyebrow">
                        LUXURYSTAY · PLAN YOUR NEXT STAY
                    </span>

                    <h1>Find your next stay</h1>

                    <p>
                        Choose a hotel, select your dates and guests,
                        then confirm an available room.
                    </p>
                </div>
            </header>

            <section className="gs-card">
                <h2>Start your reservation</h2>

                <p>
                    Availability and the final price are checked again
                    when you confirm your reservation.
                </p>

                <div className="gs-actions">
                    <Link className="gs-button" to="/rooms">
                        Search rooms
                    </Link>

                    <Link
                        className="gs-button gs-secondary"
                        to="/hotels"
                    >
                        Explore hotels
                    </Link>
                </div>

                <p>
                    After confirmation, return to My bookings to view
                    your reservation.
                </p>
            </section>
        </>
    );
}