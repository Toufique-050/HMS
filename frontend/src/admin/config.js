export const menu = [
    ["dashboard", "Overview"],
    ["hotels", "Hotels"],
    ["staff", "Staff & roles"],
    ["room-types", "Room types & rates"],
    ["rooms", "Room inventory"],
    ["bookings", "Reservations"],
    ["reservation-approvals", "Reservation approvals"],
    ["guests", "Guest profiles"],
    ["invoices", "Billing & invoices"],
    ["housekeeping", "Housekeeping"],
    ["maintenance", "Maintenance"],
    ["services", "Guest services"],
    ["reports", "Reports & analytics"],
    ["settings", "Settings & policies"],
    ["notifications", "Notifications"]
];

const f = (
    key,
    label,
    type = "text",
    extra = {}
) => ({
    key,
    label,
    type,
    ...extra
});

const hotel = f(
    "hotelId",
    "Hotel",
    "select",
    {
        source: "hotels",
        immutable: true
    }
);

const active = f(
    "isActive",
    "Active",
    "checkbox",
    {
        default: true
    }
);

const assigned = f(
    "assignedTo",
    "Assign staff",
    "select",
    {
        source: "staff",
        optional: true
    }
);

export const forms = {
    hotels: [
        f("name", "Hotel name"),
        f("location", "City / location"),

        f("address", "Address", "textarea", {
            optional: true
        }),

        f("contact", "Contact", "text", {
            optional: true
        }),

        f("images", "Photos", "images"),

        f(
            "facilities",
            "Facilities (one per line)",
            "list"
        ),

        active
    ],

    staff: [
        f("name", "Full name"),
        f("email", "Email", "email"),

        f("phone", "Phone", "text", {
            optional: true
        }),

        f("role", "Role", "select", {
            options: [
                "Manager",
                "Receptionist",
                "Housekeeping"
            ]
        }),

        {
            ...hotel,
            immutable: false
        },

        f(
            "password",
            "Initial password (12–72 characters; upper/lowercase + number)",
            "password",
            {
                createOnly: true
            }
        ),

        active
    ],

    guests: [
        f("name", "Name"),
        f("email", "Email", "email"),

        f("phone", "Phone", "text", {
            optional: true
        }),

        active
    ],

    "room-types": [
        hotel,

        f("name", "Room type"),

        f("capacity", "Guest capacity", "number", {
            default: 2,
            min: 1,
            step: 1
        }),

        f("baseRate", "Nightly rate (PKR)", "number", {
            min: 0,
            default: 0
        }),

        f(
            "amenities",
            "Amenities (one per line)",
            "list"
        ),

        f(
            "images",
            "Image URLs (one per line)",
            "list"
        ),

        active
    ],

    rooms: [
        hotel,

        f("roomTypeId", "Room type", "select", {
            source: "room-types",
            immutable: true
        }),

        f("roomNumber", "Room number"),

        f("floor", "Floor", "text", {
            optional: true
        }),

        active
    ],

    services: [
        hotel,

        f("name", "Service name"),

        f("category", "Category", "select", {
            options: [
                "food",
                "laundry",
                "transport",
                "wake_up",
                "other"
            ]
        }),

        f("price", "Price (PKR)", "number", {
            default: 0,
            min: 0
        }),

        active
    ],

    bookings: [
        f("roomId", "Physical room", "select", {
            source: "rooms"
        }),

        f(
            "guestId",
            "Registered guest (optional for walk-ins)",
            "select",
            {
                source: "guests",
                optional: true
            }
        ),

        f("guestName", "Guest name"),

        f("guestEmail", "Guest email", "email", {
            optional: true
        }),

        f("guestPhone", "Guest phone"),
        f("checkIn", "Check-in date", "date"),
        f("checkOut", "Check-out date", "date"),

        f("guests", "Guests", "number", {
            default: 1,
            min: 1,
            step: 1
        })
    ],

    housekeeping: [
        f("roomId", "Room", "select", {
            source: "rooms"
        }),

        assigned,

        f(
            "scheduledAt",
            "Schedule",
            "datetime-local"
        ),

        f("notes", "Notes", "textarea", {
            optional: true
        })
    ],

    maintenance: [
        f("roomId", "Room", "select", {
            source: "rooms"
        }),

        assigned,

        f("issue", "Issue", "textarea"),

        f("priority", "Priority", "select", {
            options: [
                "low",
                "medium",
                "high",
                "urgent"
            ]
        })
    ],

    "service-requests": [
        f(
            "bookingId",
            "Checked-in booking",
            "select",
            {
                source: "bookings"
            }
        ),

        f("serviceId", "Service", "select", {
            source: "services"
        }),

        f("quantity", "Quantity", "number", {
            min: 1,
            step: 1,
            default: 1
        }),

        f(
            "scheduledAt",
            "Schedule",
            "datetime-local"
        ),

        f(
            "notes",
            "Request details",
            "textarea",
            {
                optional: true
            }
        )
    ],

    settings: [
        hotel,

        f("taxRate", "Tax rate (%)", "number", {
            min: 0,
            max: 100,
            default: 0
        }),

        f("checkInTime", "Check-in time", "time", {
            default: "14:00"
        }),

        f("checkOutTime", "Check-out time", "time", {
            default: "12:00"
        }),

        f("invoicePrefix", "Invoice prefix", "text", {
            default: "LS"
        }),

        f(
            "cancellationPolicy",
            "Cancellation policy",
            "textarea",
            {
                optional: true
            }
        ),

        f(
            "privacyPolicy",
            "Privacy policy",
            "textarea",
            {
                optional: true
            }
        ),

        f(
            "allowOutstandingCheckout",
            "Allow checkout with an unpaid balance",
            "checkbox",
            {
                default: false
            }
        )
    ]
};

export const editResources = [
    "hotels",
    "staff",
    "guests",
    "room-types",
    "rooms",
    "services",
    "settings"
];

export const statuses = {
    bookings: [
        "pending_approval",
        "confirmed",
        "rejected",
        "checked_in",
        "checked_out",
        "cancelled",
        "no_show"
    ],

    invoices: [
        "unpaid",
        "partially_paid",
        "paid"
    ],

    housekeeping: [
        "pending",
        "in_progress",
        "completed"
    ],

    maintenance: [
        "open",
        "in_progress",
        "resolved"
    ],

    "service-requests": [
        "pending",
        "accepted",
        "completed",
        "cancelled"
    ]
};

export const columns = {
    hotels: [
        "name",
        "location",
        "contact",
        "isActive"
    ],

    staff: [
        "name",
        "email",
        "role",
        "hotelId",
        "isActive"
    ],

    guests: [
        "name",
        "email",
        "phone",
        "isActive"
    ],

    "room-types": [
        "name",
        "hotelId",
        "capacity",
        "baseRate",
        "isActive"
    ],

    rooms: [
        "roomNumber",
        "hotelId",
        "roomTypeId",
        "occupancyStatus",
        "housekeepingStatus",
        "maintenanceStatus",
        "isActive"
    ],

    bookings: [
        "reference",
        "guestSnapshot.name",
        "hotelId",
        "roomId",
        "checkIn",
        "checkOut",
        "guests",
        "paymentPreference",
        "status"
    ],

    invoices: [
        "number",
        "bookingId",
        "grandTotal",
        "paid",
        "balance",
        "status"
    ],

    services: [
        "name",
        "hotelId",
        "category",
        "price",
        "isActive"
    ],

    housekeeping: [
        "roomId",
        "assignedTo",
        "scheduledAt",
        "status"
    ],

    maintenance: [
        "roomId",
        "issue",
        "priority",
        "assignedTo",
        "status"
    ],

    "service-requests": [
        "bookingId",
        "serviceId",
        "quantity",
        "scheduledAt",
        "priceSnapshot",
        "status"
    ],

    settings: [
        "hotelId",
        "taxRate",
        "checkInTime",
        "checkOutTime",
        "allowOutstandingCheckout"
    ],

    notifications: [
        "message",
        "createdAt",
        "isRead"
    ]
};

const paymentLabels = {
    not_selected: "Not selected",
    cash: "Cash / Pay at hotel",
    card_demo: "Debit / Credit Card — Demo",
    jazzcash_demo: "JazzCash — Demo",
    easypaisa_demo: "Easypaisa — Demo"
};

export const label = key =>
    key
        .replace("guestSnapshot.", "Guest ")
        .replaceAll("Id", "")
        .replaceAll("_", " ")
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /^./,
            character => character.toUpperCase()
        );

export const keyOf = value =>
    value?._id || value || "";

export const money = value =>
    new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 2
    }).format(Number(value || 0));

export function display(value, field = "") {
    if (value == null || value === "") {
        return "—";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (typeof value === "object") {
        return (
            value.name ||
            value.roomNumber ||
            value.reference ||
            "—"
        );
    }

    if (field === "paymentPreference") {
        return paymentLabels[value] || "Not selected";
    }

    if ([
        "baseRate",
        "price",
        "grandTotal",
        "balance",
        "paid",
        "priceSnapshot",
        "rateSnapshot"
    ].includes(field)) {
        return money(value);
    }

    if ([
        "checkIn",
        "checkOut"
    ].includes(field)) {
        return String(value).slice(0, 10);
    }

    if ([
        "scheduledAt",
        "createdAt",
        "paymentPreferenceSelectedAt"
    ].includes(field)) {
        return new Date(value).toLocaleString(
            "en-PK",
            {
                timeZone: "Asia/Karachi"
            }
        );
    }

    return String(value).replaceAll("_", " ");
}