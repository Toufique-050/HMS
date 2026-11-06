import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import usePublic from "../../hooks/usePublic.js";

import {
    Hero,
    State
} from "../../components/public/Catalogue.jsx";

export default function ContactPage() {
    const result = usePublic("/hotels");
    const [params] = useSearchParams();

    const [selected, setSelected] = useState(
        params.get("hotelId") || ""
    );

    const [form, setForm] = useState({
        name: "",
        email: "",
        message: ""
    });

    const [draft, setDraft] = useState("");
    const [status, setStatus] = useState("");

   const hotels = result.data?.hotels || [];

    const hotel = hotels.find(
        item => item._id === selected
    );

    function change(key, value) {
        setForm(previous => ({
            ...previous,
            [key]: value
        }));

        setDraft("");
        setStatus("");
    }

    function prepare(event) {
        event.preventDefault();

        setDraft(
            `Hotel: ${hotel?.name || "General enquiry"}\n` +
            `Name: ${form.name.trim()}\n` +
            `Email: ${form.email.trim()}\n\n` +
            form.message.trim()
        );

        setStatus(
            "Draft prepared. Nothing has been sent."
        );
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(draft);

            setStatus(
                "Draft copied. Send it through the hotel's published contact channel."
            );
        } catch {
            setStatus(
                "Copy is unavailable. Select the draft text and copy it manually."
            );
        }
    }

    return (
        <main className="lh-page">
            <Hero title="Contact our hotels">
                Find the right hotel contact for your visit.
            </Hero>

            <section className="lh-container lh-section">
                <State {...result} retry={result.reload} />

                <div className="lh-two-grid">
                    <div>
                        {hotels.map(item => (
                            <article
                                className="lh-panel"
                                key={item._id}
                            >
                                <h2>{item.name}</h2>
                                <p>{item.address || item.location}</p>

                                <p className="lp-text">
                                    {item.contact ||
                                        "Contact details have not been published yet."}
                                </p>
                            </article>
                        ))}

                        {result.data && !hotels.length && (
                            <p>No hotel contacts have been published.</p>
                        )}
                    </div>

                    <form
                        className="lh-panel"
                        onSubmit={prepare}
                    >
                        <h2>Prepare an enquiry</h2>

                        <p>
                            Prepare a draft to copy and send through
                            the hotel's published contact channel.
                        </p>

                        <label>
                            Hotel
                            <select
                                value={selected}
                                onChange={event => {
                                    setSelected(event.target.value);
                                    setDraft("");
                                    setStatus("");
                                }}
                            >
                                <option value="">
                                    General enquiry
                                </option>

                                {hotels.map(item => (
                                    <option
                                        key={item._id}
                                        value={item._id}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Your name
                            <input
                                required
                                maxLength={80}
                                value={form.name}
                                onChange={event =>
                                    change("name", event.target.value)
                                }
                            />
                        </label>

                        <label>
                            Your email
                            <input
                                required
                                type="email"
                                maxLength={254}
                                value={form.email}
                                onChange={event =>
                                    change("email", event.target.value)
                                }
                            />
                        </label>

                        <label>
                            Message
                            <textarea
                                required
                                minLength={10}
                                maxLength={2000}
                                rows={5}
                                value={form.message}
                                onChange={event =>
                                    change(
                                        "message",
                                        event.target.value
                                    )
                                }
                            />
                        </label>

                        <button className="lh-button">
                            Prepare draft
                        </button>

                        {draft && (
                            <>
                                <label>
                                    Enquiry draft
                                    <textarea
                                        readOnly
                                        rows={8}
                                        value={draft}
                                    />
                                </label>

                                <button
                                    className="lh-button"
                                    type="button"
                                    onClick={copy}
                                >
                                    Copy draft
                                </button>
                            </>
                        )}

                        {status && <p role="status">{status}</p>}
                    </form>
                </div>
            </section>
        </main>
    );
}