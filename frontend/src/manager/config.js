export const menu = [
    ["dashboard", "Overview"],
    ["hotel", "My hotel"],
    ["room-types", "Room types & rates"],
    ["rooms", "Room inventory"],
    ["bookings", "Reservations"],
  
    ["guests", "Guest details"],
    ["invoices", "Billing & invoices"],
    ["housekeeping", "Housekeeping"],
    ["maintenance", "Maintenance"],
    ["services", "Services & requests"],
    ["reports", "Reports & analytics"],
    ["notifications", "Notifications"]
];

export const titles = Object.fromEntries(menu);

const field = (
    key,
    title,
    type = "text",
    extra = {}
) => ({
    key,
    title,
    type,
    ...extra
});

const active = field(
    "isActive",
    "Active",
    "checkbox",
    {
        default: true
    }
);

export const forms = {
    hotel: [
        field("name", "Hotel name"),
        field("location", "City / location"),

        field("address", "Address", "textarea", {
            optional: true
        }),

        field("contact", "Contact", "text", {
            optional: true
        }),

        field(
            "facilities",
            "Facilities — one per line",
            "list"
        ),

        field(
            "images",
            "Photo URLs — one HTTP/HTTPS URL per line",
            "images"
        )
    ],

    "room-types": [
        field("name", "Room type"),

        field(
            "capacity",
            "Guest capacity",
            "number",
            {
                default: 2,
                min: 1,
                max: 20,
                step: 1
            }
        ),

        field(
            "baseRate",
            "Nightly rate (PKR)",
            "number",
            {
                default: 0,
                min: 0,
                step: 0.01
            }
        ),

        field(
            "amenities",
            "Amenities — one per line",
            "list"
        ),

        field(
            "images",
            "Photo URLs — one HTTP/HTTPS URL per line",
            "images"
        ),

        active
    ],

    rooms: [
        field(
            "roomTypeId",
            "Room type",
            "select",
            {
                source: "roomTypes",
                immutable: true
            }
        ),

        field("roomNumber", "Room number"),

        field("floor", "Floor", "text", {
            optional: true
        }),

        active
    ],

    services: [
        field("name", "Service name"),

        field(
            "category",
            "Category",
            "select",
            {
                options: [
                    "food",
                    "laundry",
                    "transport",
                    "wake_up",
                    "other"
                ]
            }
        ),

        field(
            "price",
            "Price (PKR)",
            "number",
            {
                default: 0,
                min: 0,
                step: 0.01
            }
        ),

        active
    ],

    housekeeping: [
        field(
            "roomId",
            "Room",
            "select",
            {
                source: "rooms"
            }
        ),

        field(
            "assignedTo",
            "Assign housekeeping staff",
            "select",
            {
                source: "housekeepingStaff",
                optional: true
            }
        ),

        field(
            "scheduledAt",
            "Schedule (your device timezone)",
            "datetime-local"
        ),

        field(
            "notes",
            "Cleaning instructions",
            "textarea",
            {
                optional: true
            }
        )
    ],

    maintenance: [
        field(
            "roomId",
            "Room",
            "select",
            {
                source: "rooms"
            }
        ),

        field(
            "assignedTo",
            "Assign manager / housekeeping staff",
            "select",
            {
                source: "maintenanceStaff",
                optional: true
            }
        ),

        field(
            "issue",
            "Describe the issue",
            "textarea"
        ),

        field(
            "priority",
            "Priority",
            "select",
            {
                options: [
                    "low",
                    "medium",
                    "high",
                    "urgent"
                ],
                default: "medium"
            }
        )
    ]
};

export const keys = value =>
    value?._id || value || "";

export const roomLabels = rooms =>
    rooms.map(room => [
        room._id,
        `${room.roomNumber} · ${room.roomTypeId?.name || ""}`
    ]);