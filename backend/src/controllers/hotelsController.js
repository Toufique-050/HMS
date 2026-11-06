import Hotel from "../models/Hotel.js";
import { ROLES } from "../config/roles.js";
import ApiError from "../utils/ApiError.js";

export async function listHotels(req, res) {
    const filter = req.user.role === ROLES.ADMIN
        ? {}
        : {
            _id: req.user.hotelId,
            isActive: true
        };

    const hotels = await Hotel.find(filter)
        .select("name location isActive")
        .sort({ name: 1 });

    res.json({ hotels });
}

export async function createHotel(req, res) {
    const hotel = await Hotel.create(req.body);

    res.status(201).json({ hotel });
}

export async function hotelDetails(req, res) {
    if (
        req.user.role !== ROLES.ADMIN &&
        String(req.user.hotelId) !== req.params.id
    ) {
        throw new ApiError(403, "Hotel access denied");
    }

    const hotel = await Hotel.findById(req.params.id)
        .select("name location isActive");

    if (!hotel) {
        throw new ApiError(404, "Hotel not found");
    }

    res.json({ hotel });
}