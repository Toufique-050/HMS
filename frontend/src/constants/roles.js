export const ROLES = [
    "Admin",
    "Manager",
    "Receptionist",
    "Housekeeping",
    "Guest"
];

export const dashboardPath = role => {
    return `/${role.toLowerCase()}/dashboard`;
};