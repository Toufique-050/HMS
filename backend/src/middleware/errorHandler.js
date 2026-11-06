export default function errorHandler(error, req, res, next) {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            message: "Invalid JSON body"
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Request body too large"
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({
            message: "Email already registered"
        });
    }

    if (
        ["CastError", "ValidationError"].includes(error.name)
    ) {
        return res.status(400).json({
            message: "Invalid account data or ID"
        });
    }

    const status = error.status || 500;

    if (status >= 500) {
        console.error("Request failed:", error.name);
    }

    res.status(status).json({
        message: status >= 500 ? "Server error" : error.message
    });
}