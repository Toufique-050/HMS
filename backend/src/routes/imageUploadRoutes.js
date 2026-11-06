import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";

import verifyToken from "../middleware/authenticate.js";
import allowRoles from "../middleware/authorize.js";
import ApiError from "../utils/ApiError.js";

const router = Router();

const MAX_BYTES = 5 * 1024 * 1024;

const allowedMime = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 1
    },

    fileFilter(req, file, callback) {
        if (!allowedMime.has(file.mimetype)) {
            return callback(
                new ApiError(
                    400,
                    "Choose a JPG, PNG or WebP image"
                )
            );
        }

        callback(null, true);
    }
});

router.use(
    verifyToken,
    allowRoles("Admin", "Manager")
);

router.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,

    keyGenerator: req => String(req.user._id),

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        message:
            "Upload limit reached. Please try again later."
    }
}));

router.post(
    "/images/:kind",

    (req, res, next) => {
        if (
            !["hotels", "room-types"].includes(
                req.params.kind
            )
        ) {
            return next(
                new ApiError(
                    400,
                    "Invalid image category"
                )
            );
        }

        if (
            !process.env.CLOUDINARY_CLOUD_NAME ||
            !process.env.CLOUDINARY_API_KEY ||
            !process.env.CLOUDINARY_API_SECRET
        ) {
            return next(
                new ApiError(
                    503,
                    "Cloudinary settings are missing in backend/.env"
                )
            );
        }

        next();
    },

    upload.single("image"),

    async (req, res) => {
        if (!req.file) {
            throw new ApiError(
                400,
                "Choose an image first"
            );
        }

        let buffer;

        try {
            const metadata = await sharp(
                req.file.buffer,
                { limitInputPixels: 25000000 }
            ).metadata();

            if (
                !["jpeg", "png", "webp"].includes(
                    metadata.format
                ) ||
                (metadata.pages || 1) > 1
            ) {
                throw new Error("Unsupported image");
            }

            buffer = await sharp(
                req.file.buffer,
                { limitInputPixels: 25000000 }
            )
                .rotate()
                .resize({
                    width: 2000,
                    height: 2000,
                    fit: "inside",
                    withoutEnlargement: true
                })
                .webp({ quality: 85 })
                .toBuffer();
        } catch {
            throw new ApiError(
                400,
                "Invalid image. Use a non-animated JPG, PNG or WebP, up to 5 MB and 25 megapixels."
            );
        }

        cloudinary.config({
            cloud_name:
                process.env.CLOUDINARY_CLOUD_NAME,

            api_key:
                process.env.CLOUDINARY_API_KEY,

            api_secret:
                process.env.CLOUDINARY_API_SECRET,

            secure: true
        });

        let result;

        try {
            result = await new Promise(
                (resolve, reject) => {
                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                resource_type: "image",
                                type: "upload",

                                folder:
                                    `luxurystay/${req.params.kind}`,

                                public_id: randomUUID(),
                                overwrite: false,
                                allowed_formats: ["webp"],
                                timeout: 60000
                            },

                            (error, uploaded) => {
                                if (error) reject(error);
                                else resolve(uploaded);
                            }
                        );

                    stream.on("error", reject);
                    stream.end(buffer);
                }
            );

            if (
                !result?.secure_url?.startsWith(
                    "https://"
                )
            ) {
                throw new Error("Missing upload URL");
            }
        } catch {
            throw new ApiError(
                502,
                "Cloudinary upload failed. Check your Cloudinary credentials, connection and account limits."
            );
        }

        res.status(201).json({
            image: {
                url: result.secure_url,
                publicId: result.public_id
            }
        });
    }
);

router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            message:
                error.code === "LIMIT_FILE_SIZE"
                    ? "Each image must be 5 MB or smaller"
                    : "Upload one image per request using the image field"
        });
    }

    next(error);
});

export default router;