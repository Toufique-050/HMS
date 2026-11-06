
import { useMemo, useState } from "react";
import usePublic from "../../hooks/usePublic.js";
import { HotelCard, State } from "../../components/public/Catalogue.jsx";
import "../../styles/HotelsPage.css";

export default function HotelsPage() {
  const result = usePublic("/hotels");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const hotels = result.data?.hotels || [];

  const locations = useMemo(
    () =>
      [
        ...new Set(
          hotels
            .map((hotel) => hotel.location?.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [hotels]
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();

    return hotels.filter((hotel) => {
      const name = hotel.name || "";
      const place = hotel.location || "";
      const matchesSearch = `${name} ${place}`
        .toLowerCase()
        .includes(search);

      const matchesLocation = !location || place === location;

      return matchesSearch && matchesLocation;
    });
  }, [hotels, query, location]);

  const clearFilters = () => {
    setQuery("");
    setLocation("");
  };

  return (
    <main className="lh-page lux-hotels-page">
      {/* Image-free luxury banner */}
      <section className="hotels-hero">
        <div className="hotels-hero-decoration hotels-decoration-one">
          <i className="fa-solid fa-hotel" />
        </div>

        <div className="hotels-hero-decoration hotels-decoration-two">
          <i className="fa-solid fa-compass" />
        </div>

        <div className="hotels-hero-content">
          <span className="hotels-hero-label">
            <i className="fa-solid fa-star" />
            YOUR JOURNEY, OUR PRIORITY
          </span>

          <h1>
            Find a Stay
            <br />
            <span>Worth Remembering.</span>
          </h1>

          <p>
            Discover welcoming destinations, relaxing rooms, and memorable
            hotel experiences — all in one place.
          </p>

          <a href="#hotel-collection" className="hotels-hero-button">
            Explore Our Hotels
            <i className="fa-solid fa-arrow-right" />
          </a>

          <div className="hotels-hero-highlights">
            <div className="hotels-highlight">
              <span className="hotels-highlight-icon">
                <i className="fa-solid fa-bed" />
              </span>
              <span>
                <strong>Comfort First</strong>
                <small>Relax and unwind</small>
              </span>
            </div>

            <div className="hotels-highlight">
              <span className="hotels-highlight-icon">
                <i className="fa-solid fa-location-dot" />
              </span>
              <span>
                <strong>Great Locations</strong>
                <small>Find your destination</small>
              </span>
            </div>

            <div className="hotels-highlight">
              <span className="hotels-highlight-icon">
                <i className="fa-solid fa-shield-halved" />
              </span>
              <span>
                <strong>Easy Booking</strong>
                <small>Plan with confidence</small>
              </span>
            </div>
          </div>
        </div>

        <div className="hotels-hero-side-note">
          <span className="hotels-side-line" />
          <span>THE LUXURYSTAY COLLECTION</span>
        </div>
      </section>

      {/* Hotel collection */}
      <section
        className="lh-container lux-hotels-section"
        id="hotel-collection"
      >
        <div className="lux-hotels-heading">
          <div>
            <span className="lux-hotels-eyebrow">
              <i className="fa-solid fa-sparkles" />
              YOUR NEXT DESTINATION
            </span>

            <h2>Find Your Perfect Hotel</h2>

            <p>
              Every journey deserves a comfortable stay. Explore our hotel
              collection and find the place that feels right for you.
            </p>
          </div>

          <div className="lux-hotels-count">
            <span className="lux-hotels-count-icon">
              <i className="fa-solid fa-hotel" />
            </span>
            <span className="lux-hotels-count-number">
              {visible.length}
            </span>
            <span>
              {visible.length === 1 ? "Hotel Available" : "Hotels Available"}
            </span>
          </div>
        </div>

        {/* Search and filters */}
        <div className="lux-hotels-toolbar">
          <label className="lux-hotels-field">
            <span>
              <i className="fa-solid fa-magnifying-glass" />
              Search hotels
            </span>

            <div className="lux-hotels-input-wrap">
              <i className="fa-solid fa-hotel" />

              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter a hotel name or city"
              />
            </div>
          </label>

          <label className="lux-hotels-field">
            <span>
              <i className="fa-solid fa-map-location-dot" />
              Choose destination
            </span>

            <div className="lux-hotels-input-wrap">
              <i className="fa-solid fa-location-dot" />

              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              >
                <option value="">All destinations</option>

                {locations.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {(query || location) && (
            <button
              type="button"
              className="lux-hotels-reset"
              onClick={clearFilters}
            >
              <i className="fa-solid fa-rotate-left" />
              Clear filters
            </button>
          )}
        </div>

        {/* Results heading */}
        <div className="hotels-results-title">
          <div>
            <span className="hotels-results-eyebrow">
              <i className="fa-solid fa-heart" />
              SELECTED FOR YOUR COMFORT
            </span>

            <h3>Places You'll Love</h3>

            <p>
              Explore the details, discover your options, and choose a stay
              for your next trip.
            </p>
          </div>

          <span className="hotels-results-badge">
            <i className="fa-solid fa-list-check" />
            {visible.length} {visible.length === 1 ? "property" : "properties"}
          </span>
        </div>

        <div className="lux-hotels-state">
          <State {...result} retry={result.reload} />
        </div>

        {/* Keep the existing hotel card and its booking links */}
        {result.data &&
          (visible.length > 0 ? (
            <div className="lux-hotels-grid">
              {visible.map((hotel) => (
                <div className="lux-hotels-card" key={hotel._id}>
                  <HotelCard hotel={hotel} />
                </div>
              ))}
            </div>
          ) : (
            <div className="lux-hotels-empty">
              <span className="lux-hotels-empty-icon">
                <i className="fa-solid fa-hotel" />
              </span>

              <h3>No matching hotels found</h3>

              <p>
                We couldn't find a hotel matching your search. Try another
                destination or clear your filters to explore all available
                hotels.
              </p>

              <button
                type="button"
                className="lux-hotels-empty-button"
                onClick={clearFilters}
              >
                <i className="fa-solid fa-rotate-left" />
                Show all hotels
              </button>
            </div>
          ))}

        {/* Closing section */}
        <section className="hotels-closing-banner">
          <div className="hotels-closing-icon">
            <i className="fa-solid fa-suitcase-rolling" />
          </div>

          <div className="hotels-closing-copy">
            <span>YOUR NEXT CHAPTER STARTS HERE</span>
            <h3>A little comfort can make a big difference.</h3>
            <p>
              Find your destination, choose your stay, and make room for
              memorable moments.
            </p>
          </div>

          <a href="#hotel-collection" className="hotels-closing-button">
            Find Your Stay
            <i className="fa-solid fa-arrow-right" />
          </a>
        </section>
      </section>
    </main>
  );
}
