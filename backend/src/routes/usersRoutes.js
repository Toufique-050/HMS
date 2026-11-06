import { Router } from "express";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import validate from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";

import {
    createStaffSchema,
    updateStaffSchema
} from "../validators/authValidator.js";

import {
    listStaff,
    createStaff,
    updateStaff
} from "../controllers/usersController.js";

const router = Router();

router.use(
    verifyToken,
    allowRoles(ROLES.ADMIN)
);

router.get("/staff", listStaff);

router.post(
    "/staff",
    validate(createStaffSchema),
    createStaff
);

router.patch(
    "/staff/:id",
    validate(updateStaffSchema),
    updateStaff
);

export default router;