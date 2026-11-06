import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import * as auth from "../controllers/authController.js";
import verifyToken from "../middleware/authenticate.js";
import validate from "../middleware/validate.js";

import {
    signupSchema,
    loginSchema,
    profileSchema,
    changePasswordSchema
} from "../validators/authValidator.js";

const router = Router();

const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        message: "Too many attempts. Try again in 15 minutes"
    }
});

router.post(
    "/signUp",
    authLimit,
    validate(signupSchema),
    auth.signUp
);

router.post(
    "/login",
    authLimit,
    validate(loginSchema),
    auth.login
);

router.use(verifyToken);

router.get("/me", auth.me);

router.post("/logout", auth.logout);

router.patch(
    "/profile",
    validate(profileSchema),
    auth.updateProfile
);

router.post(
    "/change-password",
    authLimit,
    validate(changePasswordSchema),
    auth.changePassword
);

router.get("/dashboard/:role", (req, res) => {
    if (req.params.role !== req.user.role) {
        return res.status(403).json({
            message: "Dashboard access denied"
        });
    }

    res.json({
        message: `${req.user.role} access verified`
    });
});

export default router;