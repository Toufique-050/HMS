import jwt from "jsonwebtoken";

export function checkJwtSecret() {
    if (
        !process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32
    ) {
        throw new Error(
            "JWT_SECRET must contain at least 32 characters"
        );
    }
}

export const createToken = user => {
    return jwt.sign(
        {
            tokenVersion: user.tokenVersion,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            expiresIn: "1h",
            subject: String(user._id),
            issuer: "luxurystay-api",
            audience: "luxurystay-web"
        }
    );
};

export const readToken = token => {
    return jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
            algorithms: ["HS256"],
            issuer: "luxurystay-api",
            audience: "luxurystay-web"
        }
    );
};

// Response mein passwordHash/tokenVersion expose nahi honge.
export const publicUser = user => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hotelId: user.hotelId ? String(user.hotelId) : null,
    isActive: user.isActive
});