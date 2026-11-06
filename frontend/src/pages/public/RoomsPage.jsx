
import { useSearchParams } from "react-router-dom";

import usePublic from "../../hooks/usePublic.js";

import {
    Hero,
    RoomCard,
    SearchForm,
    State
} from "../../components/public/Catalogue.jsx";

export default function RoomsPage() {
    const [params, setParams] = useSearchParams();

    const allowed = [
        "hotelId",
        "roomTypeId",
        "checkIn",
        "checkOut",
        "guests",
        "minRate",
        "maxRate",
        "amenity",
        "q",
        "sort",
        "page"
    ];

    const query = Object.fromEntries(
        allowed
            .filter(key => params.has(key))
            .map(key => [key, params.get(key)])
    );

    const result = usePublic("/rooms", query);

    const roomItems = Array.isArray(result.data?.items)
    ? result.data.items
    : Array.isArray(result.data?.rooms)
        ? result.data.rooms
        : [];

    function update(key, value) {
        const next = new URLSearchParams(params);

        if (value) {
            next.set(key, value);
        } else {
            next.delete(key);
        }

        if (key !== "page") {
            next.delete("page");
        }

        setParams(next);
    }

    function filter(event) {
        event.preventDefault();

        const next = new URLSearchParams(params);
        const data = new FormData(event.currentTarget);

        for (const [key, value] of data.entries()) {
            const cleanedValue = String(value).trim();

            if (cleanedValue) {
                next.set(key, cleanedValue);
            } else {
                next.delete(key);
            }
        }

        next.delete("page");
        setParams(next);
    }

    return (
        <main className="lh-page lh-rooms-page">
            <Hero title="Find Your Perfect Room">
                Discover comfortable stays, compare nightly rates
                and explore rooms for your next visit.
            </Hero>

            <section className="lh-container lh-section lh-rooms-section">
                <div className="lh-rooms-intro">
                    <span className="lh-rooms-kicker">
                        YOUR STAY, YOUR CHOICE
                    </span>

                    <h2>Explore Our Rooms</h2>

                    <p>
                        Find a room that matches your travel dates,
                        budget and comfort preferences.
                    </p>
                </div>

                <div className="lh-rooms-search-panel">
                    <SearchForm
                        key={[
                            query.hotelId,
                            query.checkIn,
                            query.checkOut,
                            query.guests
                        ].join("-")}
                        initial={query}
                    />
                </div>

                <form
                    key={`${query.q || ""}-${query.maxRate || ""}-${query.amenity || ""}`}
                    className="lh-room-filters"
                    onSubmit={filter}
                >
                    <div className="lh-filter-heading">
                        <div>
                            <span className="lh-rooms-kicker">
                                REFINE YOUR SEARCH
                            </span>
                            <h3>Room filters</h3>
                        </div>

                        <button
                            type="button"
                            className="lh-filter-reset"
                            onClick={() => {
                                const next = new URLSearchParams(params);

                                ["q", "maxRate", "amenity", "page"].forEach(
                                    key => next.delete(key)
                                );

                                setParams(next);
                            }}
                        >
                            Clear filters
                        </button>
                    </div>

                    <div className="lh-filter-fields">
                        <label className="lh-filter-field">
                            <span>Room name</span>
                            <input
                                name="q"
                                type="search"
                                defaultValue={query.q || ""}
                                maxLength={100}
                                placeholder="Search room types"
                            />
                        </label>

                        <label className="lh-filter-field">
                            <span>Maximum nightly rate</span>
                            <input
                                name="maxRate"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={query.maxRate || ""}
                                placeholder="Enter your budget"
                            />
                        </label>

                        <label className="lh-filter-field">
                            <span>Amenity</span>
                            <input
                                name="amenity"
                                defaultValue={query.amenity || ""}
                                maxLength={200}
                                placeholder="e.g. Wi-Fi"
                            />
                        </label>

                        <button
                            type="submit"
                            className="lh-button lh-filter-submit"
                        >
                            Apply Filters
                        </button>
                    </div>
                </form>

                <div className="lh-rooms-toolbar">
                    <div className="lh-rooms-result">
                        <span className="lh-result-icon">✦</span>

                        <div>
                            <strong>
                                {result.data?.total ?? "—"} rooms
                            </strong>
                            <span>Matching your search</span>
                        </div>
                    </div>

                    <label className="lh-sort-control">
                        <span>Sort by</span>

                        <select
                            value={query.sort || "name"}
                            onChange={event =>
                                update("sort", event.target.value)
                            }
                        >
                            <option value="name">Room name</option>
                            <option value="price-low">
                                Price: low to high
                            </option>
                            <option value="price-high">
                                Price: high to low
                            </option>
                            <option value="capacity">
                                Guest capacity
                            </option>
                        </select>
                    </label>
                </div>

                <State {...result} retry={result.reload} />

                {result.data && (
                    <>
                        <div
                            className={`lh-availability-note ${
                                result.data.datesChecked
                                    ? "is-checked"
                                    : "is-pending"
                            }`}
                            role="status"
                        >
                            <span className="lh-availability-symbol">
                                {result.data.datesChecked ? "✓" : "i"}
                            </span>

                            <p>
                                {result.data.datesChecked
                                    ? "Availability has been checked for your selected dates. It will be verified again when you confirm your booking."
                                    : "Select your check-in and check-out dates to check room availability."}
                            </p>
                        </div>

                     {roomItems.length > 0 ? (
                            <div className="lh-room-grid">
                             {roomItems.map(room => (
                                    <RoomCard
                                        key={room._id}
                                        room={room}
                                        search={{
                                            hotelId: query.hotelId,
                                            checkIn: query.checkIn,
                                            checkOut: query.checkOut,
                                            guests: query.guests
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="lh-rooms-empty">
                                <div className="lh-empty-icon">⌕</div>

                                <h2>No matching rooms found</h2>

                                <p>
                                    Try changing your travel dates,
                                    guest count or filters to explore
                                    other available options.
                                </p>

                                <button
                                    type="button"
                                    className="lh-button"
                                    onClick={() => {
                                        const next = new URLSearchParams(params);

                                        [
                                            "q",
                                            "maxRate",
                                            "amenity",
                                            "page"
                                        ].forEach(key => next.delete(key));

                                        setParams(next);
                                    }}
                                >
                                    Clear filters
                                </button>
                            </div>
                        )}

                        {roomItems.length > 0 && (
                            <nav
                                className="lh-pagination"
                                aria-label="Room listing pages"
                            >
                                <button
                                    type="button"
                                    className="lh-pagination-button"
                                    disabled={result.data.page <= 1}
                                    onClick={() =>
                                        update(
                                            "page",
                                            String(result.data.page - 1)
                                        )
                                    }
                                >
                                    ← Previous
                                </button>

                                <span className="lh-pagination-status">
                                    Page <strong>{result.data.page}</strong>
                                    {" "}of{" "}
                                    <strong>{result.data.pages}</strong>
                                </span>

                                <button
                                    type="button"
                                    className="lh-pagination-button"
                                    disabled={
                                        result.data.page >= result.data.pages
                                    }
                                    onClick={() =>
                                        update(
                                            "page",
                                            String(result.data.page + 1)
                                        )
                                    }
                                >
                                    Next →
                                </button>
                            </nav>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}
