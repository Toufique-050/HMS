import { useState } from "react";

import usePublic from "../../hooks/usePublic.js";

import {
    Hero,
    Policies,
    State
} from "../../components/public/Catalogue.jsx";

const faqs = [
    [
        "How is availability checked?",
        "Availability uses your selected dates, guest count and reserved room nights. It is checked again when you confirm; a search does not reserve a room."
    ],
    [
        "How are nights counted?",
        "Checkout is excluded. A stay from the 15th to the 18th has three nights."
    ],
    [
        "What is included in the estimate?",
        "The estimate includes the room charge and configured hotel tax. Additional services are billed separately."
    ],
    [
        "Is an online payment collected?",
        "No. This flow confirms a reservation and creates its invoice. Contact your hotel about payment arrangements."
    ],
    [
        "How do I book?",
        "Select a room and dates, sign in with a Guest account, review the hotel's policies and confirm the reservation."
    ],
    [
        "Can staff self-register?",
        "No. Staff accounts and hotel assignments are managed by the Admin."
    ]
];

function HotelPolicy({ hotelId }) {
    const result = usePublic(`/hotels/${hotelId}`);

    return (
        <>
            <State {...result} retry={result.reload} />

            {result.data && (
                <Policies policy={result.data.policy} />
            )}
        </>
    );
}

export default function PoliciesFaqPage() {
    const hotels = usePublic("/hotels");

    const [hotelId, setHotelId] = useState("");
    const [query, setQuery] = useState("");

    const visible = faqs.filter(item =>
        item.join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
    );

    return (
        <main className="lh-page">
            <Hero title="Policies & FAQs">
                Review your hotel's policies before
                confirming a reservation.
            </Hero>

            <section className="lh-container lh-section">
                <State {...hotels} retry={hotels.reload} />

                <label>
                    Select hotel
                    <select
                        value={hotelId}
                        onChange={event =>
                            setHotelId(event.target.value)
                        }
                    >
                        <option value="">Choose a hotel</option>

                        {hotels.data?.items.map(hotel => (
                            <option
                                key={hotel._id}
                                value={hotel._id}
                            >
                                {hotel.name}
                            </option>
                        ))}
                    </select>
                </label>

                {hotelId && (
                    <HotelPolicy
                        key={hotelId}
                        hotelId={hotelId}
                    />
                )}

                <div className="lh-panel">
                    <h2>Frequently asked questions</h2>

                    <label>
                        Search questions
                        <input
                            type="search"
                            value={query}
                            onChange={event =>
                                setQuery(event.target.value)
                            }
                        />
                    </label>

                    {visible.map(([title, answer]) => (
                        <details
                            className="lp-faq"
                            key={title}
                        >
                            <summary>{title}</summary>
                            <p>{answer}</p>
                        </details>
                    ))}
                </div>
            </section>
        </main>
    );
}