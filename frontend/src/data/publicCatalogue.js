// Sample data only. Connect public hotel/room APIs in the next backend phase.
const photo = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`;
export const images = {
  resort: photo("photo-1566073771259-6a8506099945"),
  lounge: photo("photo-1542314831-068cd1dbfeeb"),
  classic: photo("photo-1611892440504-42a792e24d32"),
  deluxe: photo("photo-1590490360182-c33d57733427"),
  suite: photo("photo-1582719478250-c89cae4dc85b"),
};
export const hotels = [
  {
    id: "karachi",
    name: "LuxuryStay Karachi",
    city: "Karachi",
    region: "Sindh, Pakistan",
    headline: "A little calm in a city that never stands still.",
    description:
      "An illustrative urban retreat for business visits, family stays and relaxed weekends. Explore comfortable spaces and thoughtful guest-service options.",
    image: images.resort,
    gallery: [images.resort, images.classic, images.suite],
    facilities: [
      "Wi-Fi",
      "Dining",
      "Guest services",
      "Transportation requests",
    ],
    mood: "City retreat",
    address: null,
    phone: null,
    email: null,
  },
  {
    id: "lahore",
    name: "LuxuryStay Lahore",
    city: "Lahore",
    region: "Punjab, Pakistan",
    headline: "Warm interiors. An unhurried welcome.",
    description:
      "A sample destination for cultural visits and comfortable city breaks. Discover generous room layouts and a quieter space to unwind after your day.",
    image: images.lounge,
    gallery: [images.lounge, images.deluxe, images.suite],
    facilities: [
      "Wi-Fi",
      "Dining",
      "Guest services",
      "Transportation requests",
    ],
    mood: "Culture & comfort",
    address: null,
    phone: null,
    email: null,
  },
];
export const rooms = [
  {
    id: "classic",
    name: "Classic Comfort",
    hotelId: "karachi",
    hotel: "Karachi",
    type: "Classic room",
    guests: 2,
    rate: 12000,
    size: 28,
    bed: "Double bed",
    image: images.classic,
    gallery: [images.classic, images.deluxe, images.resort],
    description:
      "A calm, comfortable space with warm interiors and room to unwind.",
    longDescription:
      "Designed around the essentials of a restful stay: soft finishes, a practical workspace and space to settle in. This sample room layout suits a solo visit or a stay for two.",
    amenities: ["Double bed", "Wi-Fi", "Workspace", "Air conditioning"],
  },
  {
    id: "deluxe",
    name: "Deluxe Retreat",
    hotelId: "lahore",
    hotel: "Lahore",
    type: "Deluxe room",
    guests: 3,
    rate: 18000,
    size: 38,
    bed: "King bed",
    image: images.deluxe,
    gallery: [images.deluxe, images.classic, images.lounge],
    description:
      "Thoughtful details, generous space and a relaxed atmosphere for your visit.",
    longDescription:
      "An inviting sample room with a king-bed layout, a seating corner and extra room to enjoy a slower morning. Illustrative capacity and features must be confirmed with the actual property.",
    amenities: ["King bed", "Wi-Fi", "Seating area", "Air conditioning"],
  },
  {
    id: "suite",
    name: "Signature Suite",
    hotelId: "karachi",
    hotel: "Karachi",
    type: "Suite",
    guests: 4,
    rate: 26000,
    size: 55,
    bed: "Bedroom & lounge",
    image: images.suite,
    gallery: [images.suite, images.classic, images.resort],
    description:
      "A spacious stay with a separate lounge for families and longer visits.",
    longDescription:
      "A sample suite concept with distinct sleeping and relaxing spaces. The separate lounge makes this a useful option to explore for family visits and longer stays.",
    amenities: [
      "Bedroom & lounge",
      "Wi-Fi",
      "Family space",
      "Air conditioning",
    ],
  },
];
export const money = (value) =>
  `Rs. ${new Intl.NumberFormat("en-PK").format(value)}`;
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function nextDay(value) {
  const d = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(d.getTime()))
    return today();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
  return Number.isInteger(nights) && nights > 0 ? nights : 0;
}
export function validateDates(checkIn, checkOut) {
  if (!checkIn && !checkOut) return "";
  if (!checkIn || !checkOut) return "Choose both check-in and check-out dates.";
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(checkIn) || !validDate(checkOut))
    return "Choose valid stay dates.";
  if (checkIn < today()) return "Check-in cannot be in the past.";
  if (!nightsBetween(checkIn, checkOut))
    return "Check-out must be after check-in.";
  return "";
}
export function getSearch(params) {
  const hotel = params.get("hotel") || "All";
  const type = params.get("type") || "All";
  const requestedGuests = Number(params.get("guests") || 2);
  const requestedBudget = Number(params.get("budget") || 30000);
  const sort = params.get("sort") || "recommended";
  return {
    hotel: ["All", ...hotels.map((h) => h.city)].includes(hotel)
      ? hotel
      : "All",
    type: ["All", ...rooms.map((r) => r.type)].includes(type) ? type : "All",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    guests: String(
      Number.isInteger(requestedGuests) &&
        requestedGuests >= 1 &&
        requestedGuests <= 4
        ? requestedGuests
        : 2,
    ),
    budget: String(
      Number.isFinite(requestedBudget) &&
        requestedBudget >= 5000 &&
        requestedBudget <= 30000
        ? requestedBudget
        : 30000,
    ),
    sort: ["recommended", "price-low", "price-high", "capacity"].includes(sort)
      ? sort
      : "recommended",
    amenity: [
      "All",
      "Wi-Fi",
      "Workspace",
      "Family space",
      "Seating area",
    ].includes(params.get("amenity"))
      ? params.get("amenity")
      : "All",
  };
}
export function searchQuery(values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== "" && value !== undefined && value !== null)
      query.set(key, String(value));
  return query.toString();
}
export const hotelRooms = (id) => rooms.filter((room) => room.hotelId === id);
export const getHotel = (id) => hotels.find((hotel) => hotel.id === id);
export const getRoom = (id) => rooms.find((room) => room.id === id);
