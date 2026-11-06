import { useParams } from "react-router-dom";

import usePublic from "../../hooks/usePublic.js";

import {
    Gallery,
    Hero,
    Policies,
    RoomCard,
    SearchForm,
    State
} from "../../components/public/Catalogue.jsx";

export default function HotelDetailsPage() {
    const { hotelId } = useParams();

    const result = usePublic(`/hotels/${hotelId}`);

    const rooms = usePublic("/rooms", {
        hotelId,
        limit: 6
    });

    const hotel = result.data?.hotel;

    return (
   <main className="lh-page lh-hotel-details-page">
            <Hero title={hotel?.name || "Hotel details"}>
                {hotel?.location}
            </Hero>

            <section className="lh-container lh-section">
                <State {...result} retry={result.reload} />

                {hotel && (
                    <>
                        <div className="lh-property-layout">
                            <Gallery
                                key={hotel._id}
                                images={hotel.images}
                                title={hotel.name}
                            />

                            <div className="lh-panel">
                                <h2>{hotel.name}</h2>

                                <p>
                                    {hotel.address || hotel.location}
                                </p>

                                <p>
                                    Contact:{" "}
                                    {hotel.contact ||
                                        "Contact details have not been published."}
                                </p>

                                <div className="lh-chips">
                                    {hotel.facilities?.map(item => (
                                        <span key={item}>{item}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="lh-space">
                            <SearchForm
                                key={hotel._id}
                                fixedHotel={hotel._id}
                            />
                        </div>

                        <div className="lh-section-heading">
                            <h2>Explore our rooms</h2>
                        </div>

                        <State {...rooms} retry={rooms.reload} />

                        <div className="lh-room-grid">
                            {rooms.data?.items.map(room => (
                                <RoomCard
                                    key={room._id}
                                    room={room}
                                    search={{ hotelId }}
                                />
                            ))}
                        </div>

                        {rooms.data && !rooms.data.items.length && (
                            <p>
                                No rooms are currently listed at this hotel.
                            </p>
                        )}

                        <Policies policy={result.data.policy} />
                    </>
                )}
            </section>
        </main>
    );
}