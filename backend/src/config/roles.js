export const ROLES = Object.freeze({
    ADMIN: "Admin",
    MANAGER: "Manager",
    RECEPTIONIST: "Receptionist",
    HOUSEKEEPING: "Housekeeping",
    GUEST: "Guest"
});

export const ALL_ROLES = Object.freeze(
    Object.values(ROLES)
);

export const STAFF_ROLES = Object.freeze(
    ALL_ROLES.filter(role => role !== ROLES.GUEST)
);

export const HOTEL_SCOPED_ROLES = Object.freeze([
    ROLES.MANAGER,
    ROLES.RECEPTIONIST,
    ROLES.HOUSEKEEPING
]);