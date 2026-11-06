import { Router } from "express";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import validate from "../middleware/validate.js";

import {
    STAFF_ROLES,
    ROLES
} from "../config/roles.js";

import { hotelSchema } from "../validators/authValidator.js";

import {
    listHotels,
    createHotel,
    hotelDetails
} from "../controllers/hotelsController.js";

const router = Router();

router.use(
    verifyToken,
    allowRoles(...STAFF_ROLES)
);

router.get("/", listHotels);

router.post(
    "/",
    allowRoles(ROLES.ADMIN),
    validate(hotelSchema),
    createHotel
);

router.get("/:id", hotelDetails);

export default router;