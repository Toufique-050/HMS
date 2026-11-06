import { useEffect, useRef, useState } from "react";

import http, { errorMessage } from "../api/http.js";

import {
    forms,
    editResources,
    columns,
    statuses,
    label,
    keyOf,
    display,
    money
} from "./config.js";

import AdminFields from "./AdminFields.jsx";
import useHotelRealtime from "../hooks/useHotelRealtime.js";

function valueAt(row, key) {
    return key
        .split(".")
        .reduce((value, part) => value?.[part], row);
}

function normalizeFields(fields = []) {
    return fields.map(field =>
        field.key === "images"
            ? {
                ...field,
                type: "images",
                label: "Photos"
            }
            : field
    );
}

function initialForm(fields, record = {}) {
    return Object.fromEntries(
        normalizeFields(fields).map(field => {
            let value =
                record[field.key] ??
                field.default ??
                (
                    field.type === "checkbox"
                        ? false
                        : ""
                );

            if (field.type === "select") {
                value = keyOf(value);
            }

            if (field.type === "images") {
                value = Array.isArray(value)
                    ? value
                    : [];
            }

            if (field.type === "list") {
                value = Array.isArray(value)
                    ? value.join("\n")
                    : value;
            }

            if (
                field.type === "datetime-local" &&
                !value
            ) {
                value = new Date(
                    Date.now() -
                    new Date().getTimezoneOffset() * 60000
                )
                    .toISOString()
                    .slice(0, 16);
            }

            return [field.key, value];
        })
    );
}

function payload(fields, form, editing) {
    return Object.fromEntries(
        fields
            .filter(field =>
                !(editing && field.createOnly)
            )
            .map(field => {
                let value = form[field.key];

                if (field.type === "number") {
                    value = Number(value);
                }

                if (field.type === "images") {
                    value = Array.isArray(value)
                        ? value
                        : [];
                }

                if (field.type === "list") {
                    value = String(value ?? "")
                        .split("\n")
                        .map(item => item.trim())
                        .filter(Boolean);
                }

                if (
                    field.type === "select" &&
                    field.optional &&
                    !value
                ) {
                    value = null;
                }

                if (field.type === "datetime-local") {
                    value = new Date(value).toISOString();
                }

                return [field.key, value];
            })
    );
}

function Dialog({
    title,
    children,
    onClose,
    busy
}) {
    const ref = useRef(null);
    const previous = useRef(null);

    useEffect(() => {
        previous.current = document.activeElement;
        ref.current.showModal();

        return () => {
            previous.current?.focus?.();
        };
    }, []);

    return (
        <dialog
            ref={ref}
            className="lsa-dialog"

            onCancel={event => {
                event.preventDefault();

                if (!busy) {
                    onClose();
                }
            }}
        >
            <div className="lsa-dialog-heading">
                <h2>{title}</h2>

                <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    aria-label="Close dialog"
                >
                    Close
                </button>
            </div>

            {children}
        </dialog>
    );
}

export default function AdminPage({
    resource: section
}) {
    const [tab, setTab] = useState("services");

    const resource =
        section === "services"
            ? tab
            : section;

    const [items, setItems] = useState([]);
    const [lookups, setLookups] = useState({});

    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [hotelId, setHotelId] = useState("");
    const [status, setStatus] = useState("");

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [lookupError, setLookupError] = useState("");

    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState({});
    const [refresh, setRefresh] = useState(0);

    const uploadInFlight = useRef(false);
    const saveInFlight = useRef(false);

    const fields = normalizeFields(
        dialog?.fields || forms[resource] || []
    );
    const liveRevision = useHotelRealtime();

    function uploadStatus(value) {
        uploadInFlight.current = value;
        setUploading(value);
    }

    function closeDialog() {
        if (
            uploadInFlight.current ||
            saveInFlight.current
        ) {
            return;
        }

        setDialog(null);
        setError("");
    }

    useEffect(() => {
        setPage(1);
        setSearch("");
        setQuery("");
        setStatus("");
        setError("");
        setSuccess("");
    }, [resource]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setQuery(search);
            setPage(1);
        }, 300);

        return () => clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError("");

            try {
                const { data } = await http.get(
                    `/admin/${resource}`,
                    {
                        params: {
                            page,
                            q: query,
                            hotelId,
                            status
                        },

                        signal: controller.signal
                    }
                );

                setItems(data.items);
                setPages(data.pages);
                setTotal(data.total);
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(errorMessage(caught));
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => controller.abort();
   }, [
    resource,
    page,
    query,
    hotelId,
    status,
    refresh,
    liveRevision
]);
    useEffect(() => {
        const controller = new AbortController();

        async function all(name) {
            const rows = [];

            let current = 1;
            let last = 1;

            do {
                const { data } = await http.get(
                    `/admin/${name}`,
                    {
                        params: {
                            limit: 500,
                            page: current
                        },

                        signal: controller.signal
                    }
                );

                rows.push(...data.items);
                last = data.pages;
                current++;
            } while (current <= last);

            return [name, rows];
        }

        Promise.all(
            [
                "hotels",
                "room-types",
                "rooms",
                "staff",
                "guests",
                "services",
                "bookings"
            ].map(all)
        )
            .then(entries => {
                setLookups(
                    Object.fromEntries(entries)
                );

                setLookupError("");
            })
            .catch(caught => {
                if (!controller.signal.aborted) {
                    setLookupError(
                        errorMessage(caught)
                    );
                }
            });

        return () => controller.abort();
 }, [refresh, liveRevision]);
    useEffect(() => {
        if (dialog || busy || uploading) {
            return;
        }

        const timer = setInterval(() => {
            if (!document.hidden) {
                setRefresh(value => value + 1);
            }
        }, 60000);

        return () => clearInterval(timer);
    }, [dialog, busy, uploading]);

    function edit(record = null) {
        setError("");
        setSuccess("");

        setDialog({
            kind: "edit",
            record
        });

        setForm(
            initialForm(
                forms[resource],
                record || {}
            )
        );
    }

    function operation(
        row,
        action,
        actionFields = [],
        defaults = {}
    ) {
        setError("");
        setSuccess("");

        setDialog({
            kind: "action",
            record: row,
            action,
            fields: actionFields
        });

        setForm({
            ...initialForm(actionFields),
            ...defaults
        });
    }

    async function save(event) {
        event.preventDefault();

        if (
            !dialog ||
            busy ||
            uploading ||
            saveInFlight.current ||
            uploadInFlight.current
        ) {
            return;
        }

        saveInFlight.current = true;
        setBusy(true);
        setError("");

        try {
            const data = payload(
                fields,
                form,
                dialog.kind === "edit" &&
                !!dialog.record
            );

            if (dialog.kind === "edit") {
                if (dialog.record) {
                    await http.put(
                        `/admin/${resource}/${dialog.record._id}`,
                        data
                    );
                } else {
                    await http.post(
                        `/admin/${resource}`,
                        data
                    );
                }
            } else {
                if (dialog.action === "payment") {
                    data.key = dialog.paymentKey;
                }

                await http.post(
                    `/admin/${resource}/${dialog.record._id}/${dialog.action}`,
                    data
                );
            }

            setDialog(null);
            setSuccess("Saved successfully.");
            setRefresh(value => value + 1);
        } catch (caught) {
            setError(errorMessage(caught));
        } finally {
            saveInFlight.current = false;
            setBusy(false);
        }
    }

    function options(field) {
        let rows = lookups[field.source] || [];

        const selectedRoom =
            lookups.rooms?.find(
                room => room._id === form.roomId
            );

        const chosenHotel =
            form.hotelId ||
            keyOf(selectedRoom?.hotelId) ||
            keyOf(dialog?.record?.hotelId);

        if (
            field.source !== "hotels" &&
            chosenHotel &&
            ["room-types", "staff"].includes(
                field.source
            )
        ) {
            rows = rows.filter(
                row =>
                    keyOf(row.hotelId) === chosenHotel
            );
        }

        if (field.source === "staff") {
            rows = rows.filter(row =>
                row.isActive &&
                (
                    resource === "housekeeping"
                        ? row.role === "Housekeeping"
                        : ["Manager", "Housekeeping"].includes(
                            row.role
                        )
                )
            );
        }

        if (field.source === "bookings") {
            rows = rows.filter(
                row => row.status === "checked_in"
            );
        }

        if (
            [
                "rooms",
                "room-types",
                "services",
                "hotels",
                "guests"
            ].includes(field.source)
        ) {
            rows = rows.filter(
                row =>
                    row.isActive ||
                    row._id === form[field.key]
            );
        }

        if (
            field.source === "services" &&
            form.bookingId
        ) {
            const booking =
                lookups.bookings?.find(
                    item =>
                        item._id === form.bookingId
                );

            if (booking) {
                rows = rows.filter(
                    row =>
                        keyOf(row.hotelId) ===
                        keyOf(booking.hotelId)
                );
            }
        }

        if (field.options) {
            return field.options.map(value => [
                value,
                label(value)
            ]);
        }

        return rows.map(row => [
            row._id,

            [
                row.name ||
                row.roomNumber ||
                row.reference,

                row.hotelId?.name
            ]
                .filter(Boolean)
                .join(" · ")
        ]);
    }

    function buttons(row) {
        const result = [];

        function add(
            text,
            action,
            actionFields = [],
            values = {}
        ) {
            result.push(
                <button
                    key={text}
                    type="button"

                    onClick={() =>
                        operation(
                            row,
                            action,
                            actionFields,
                            values
                        )
                    }
                >
                    {text}
                </button>
            );
        }

        if (
            editResources.includes(resource) &&
            !(
                resource === "staff" &&
                row.role === "Admin"
            )
        ) {
            result.push(
                <button
                    key="edit"
                    type="button"
                    onClick={() => edit(row)}
                >
                    Edit
                </button>
            );
        }

        if (resource === "rooms") {
            add(
                "Readiness",
                "readiness",
                [
                    {
                        key: "housekeepingStatus",
                        label: "Cleaning status",
                        type: "select",

                        options: [
                            "clean",
                            "dirty",
                            "cleaning"
                        ]
                    },
                    {
                        key: "maintenanceStatus",
                        label: "Maintenance status",
                        type: "select",

                        options: [
                            "operational",
                            "out_of_service"
                        ]
                    }
                ],
                {
                    housekeepingStatus:
                        row.housekeepingStatus,

                    maintenanceStatus:
                        row.maintenanceStatus
                }
            );
        }

        if (resource === "bookings") {
            if (row.status === "confirmed") {
                add(
                    "Check in",
                    "check-in",
                    [{
                        key: "keyReference",
                        label: "Key / card reference",
                        type: "text"
                    }]
                );

                add("Cancel", "cancel");
                add("No-show", "no-show");
            }

            if (row.status === "checked_in") {
                add("Check out", "check-out");
            }

            if (
                ["confirmed", "checked_in"].includes(
                    row.status
                )
            ) {
                add(
                    "Extend stay",
                    "extend",
                    [{
                        key: "checkOut",
                        label: "New checkout date",
                        type: "date"
                    }]
                );

                add(
                    "Change room",
                    "change-room",
                    [{
                        key: "roomId",
                        label: "New room",
                        type: "select",
                        source: "rooms"
                    }]
                );
            }
        }

        if (
            ["housekeeping", "maintenance"].includes(
                resource
            ) &&
            !["completed", "resolved"].includes(
                row.status
            )
        ) {
            add(
                "Assign",
                "assign",
                [{
                    key: "assignedTo",
                    label: "Assign staff",
                    type: "select",
                    source: "staff"
                }]
            );

            const next =
                resource === "housekeeping"
                    ? (
                        row.status === "pending"
                            ? "in_progress"
                            : "completed"
                    )
                    : (
                        row.status === "open"
                            ? "in_progress"
                            : "resolved"
                    );

            add(
                label(next),
                "status",
                [
                    {
                        key: "status",
                        label: "Next status",
                        type: "select",
                        options: [next]
                    },

                    ...(
                        next === "resolved"
                            ? [{
                                key: "resolution",
                                label: "Resolution",
                                type: "textarea"
                            }]
                            : []
                    )
                ],
                { status: next }
            );
        }

        if (resource === "service-requests") {
            const next = {
                pending: [
                    "accepted",
                    "cancelled"
                ],
                accepted: [
                    "completed",
                    "cancelled"
                ]
            }[row.status] || [];

            next.forEach(nextStatus => {
                add(
                    label(nextStatus),
                    "status",
                    [{
                        key: "status",
                        label: "Next status",
                        type: "select",
                        options: [nextStatus]
                    }],
                    { status: nextStatus }
                );
            });
        }

        if (resource === "invoices") {
            result.push(
                <button
                    key="view"
                    type="button"

                    onClick={() => {
                        setDialog({
                            kind: "invoice",
                            record: row
                        });

                        setError("");
                    }}
                >
                    View / print
                </button>
            );

            if (row.balance > 0) {
                result.push(
                    <button
                        key="pay"
                        type="button"

                        onClick={() => {
                            operation(
                                row,
                                "payment",
                                [
                                    {
                                        key: "amount",
                                        label: "Amount (PKR)",
                                        type: "number",
                                        min: 0.01,
                                        max: row.balance
                                    },
                                    {
                                        key: "method",
                                        label: "Method",
                                        type: "select",

                                        options: [
                                            "cash",
                                            "bank",
                                            "card"
                                        ]
                                    },
                                    {
                                        key: "reference",
                                        label: "Payment reference",
                                        type: "text",
                                        optional: true
                                    }
                                ],
                                {
                                    amount: row.balance,
                                    method: "cash"
                                }
                            );

                            setDialog(previous => ({
                                ...previous,
                                paymentKey:
                                    crypto.randomUUID()
                            }));
                        }}
                    >
                        Record payment
                    </button>
                );
            }

            if (
                ["confirmed", "checked_in"].includes(
                    row.bookingId?.status
                )
            ) {
                add(
                    "Discount",
                    "discount",
                    [{
                        key: "discount",
                        label: "Discount (PKR)",
                        type: "number",
                        min: 0,
                        max: row.subtotal
                    }],
                    {
                        discount: row.discount
                    }
                );
            }

            add("Email guest", "email");
        }

        if (
            resource === "notifications" &&
            !row.isRead
        ) {
            add("Mark read", "read");
        }

        return result.length
            ? result
            : "—";
    }

    const title = {
        "room-types": "Room types & rates",
        "service-requests": "Service requests",
        staff: "Staff & roles",
        invoices: "Billing & invoices"
    }[resource] || label(
        resource.replaceAll("-", " ")
    );

    return (
        <section>
            <div className="lsa-heading">
                <div>
                    <span className="lsa-eyebrow">
                        LUXURYSTAY · ADMIN
                    </span>

                    <h1>{title}</h1>
                    <p>Manage records across your hotels.</p>
                </div>

                {forms[resource] &&
                    resource !== "guests" && (
                        <button
                            type="button"
                            onClick={() => edit()}
                        >
                            + Add{" "}
                            {label(
                                resource === "bookings"
                                    ? "reservation"
                                    : resource.replaceAll("-", " ")
                            )}
                        </button>
                    )}
            </div>

            {section === "services" && (
                <div className="lsa-tabs">
                    {[
                        "services",
                        "service-requests"
                    ].map(value => (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={tab === value}

                            onClick={() => {
                                setTab(value);
                                setPage(1);
                            }}
                        >
                            {label(
                                value.replaceAll("-", " ")
                            )}
                        </button>
                    ))}
                </div>
            )}

            {success && (
                <p
                    className="lsa-success"
                    role="status"
                >
                    {success}
                </p>
            )}

            {error && !dialog && (
                <p
                    className="lsa-error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {lookupError && (
                <p
                    className="lsa-error"
                    role="alert"
                >
                    Options could not load: {lookupError}
                    {" "}

                    <button
                        type="button"
                        onClick={() =>
                            setRefresh(value => value + 1)
                        }
                    >
                        Retry
                    </button>
                </p>
            )}

            <div className="lsa-card lsa-toolbar">
                <label>
                    Search

                    <input
                        type="search"
                        value={search}
                        placeholder="Search records…"

                        onChange={event =>
                            setSearch(event.target.value)
                        }
                    />
                </label>

                {![
                    "hotels",
                    "guests",
                    "notifications"
                ].includes(resource) && (
                    <label>
                        Hotel

                        <select
                            value={hotelId}

                            onChange={event => {
                                setHotelId(
                                    event.target.value
                                );

                                setPage(1);
                            }}
                        >
                            <option value="">
                                All hotels
                            </option>

                            {lookups.hotels?.map(hotel => (
                                <option
                                    key={hotel._id}
                                    value={hotel._id}
                                >
                                    {hotel.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {statuses[resource] && (
                    <label>
                        Status

                        <select
                            value={status}

                            onChange={event => {
                                setStatus(
                                    event.target.value
                                );

                                setPage(1);
                            }}
                        >
                            <option value="">
                                All statuses
                            </option>

                            {statuses[resource].map(value => (
                                <option
                                    key={value}
                                    value={value}
                                >
                                    {label(value)}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <button
                    type="button"
                    disabled={loading}

                    onClick={() =>
                        setRefresh(value => value + 1)
                    }
                >
                    Refresh
                </button>
            </div>

            {resource === "bookings" && (
                <p className="lsa-hint">
                    Dates use Asia/Karachi.
                    Rate and tax snapshots are saved
                    by the server. Room capacity and
                    availability are checked on save.
                </p>
            )}

            {resource === "settings" && (
                <p className="lsa-hint">
                    One settings record per hotel.
                    Changes apply to future invoices.
                    Displayed check-in/out times are
                    policy text; arrival actions validate
                    the reserved calendar dates.
                </p>
            )}

            {resource === "guests" && (
                <p className="lsa-hint">
                    Guests self-register. Walk-in
                    reservations can be created
                    without a guest account.
                </p>
            )}

            <div
                className="lsa-card lsa-table-scroll"
                aria-busy={loading}
            >
                {loading ? (
                    <p role="status">
                        Loading records…
                    </p>
                ) : !items.length ? (
                    <div className="lsa-empty">
                        <h2>No records found</h2>

                        <p>
                            Add a record or adjust
                            the filters.
                        </p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                {(columns[resource] || []).map(
                                    key => (
                                        <th key={key}>
                                            {label(key)}
                                        </th>
                                    )
                                )}

                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {items.map(row => (
                                <tr key={row._id}>
                                    {(columns[resource] || []).map(
                                        key => (
                                            <td key={key}>
                                                {key === "status" ? (
                                                    <span className="lsa-badge">
                                                        {display(
                                                            valueAt(row, key),
                                                            key
                                                        )}
                                                    </span>
                                                ) : (
                                                    display(
                                                        valueAt(row, key),
                                                        key
                                                    )
                                                )}
                                            </td>
                                        )
                                    )}

                                    <td>
                                        <div className="lsa-row-actions">
                                            {buttons(row)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="lsa-pagination">
                <span>
                    {total} records · Page {page}
                    {" of "}
                    {pages}
                </span>

                <button
                    type="button"
                    disabled={page <= 1 || loading}

                    onClick={() =>
                        setPage(value => value - 1)
                    }
                >
                    Previous
                </button>

                <button
                    type="button"
                    disabled={page >= pages || loading}

                    onClick={() =>
                        setPage(value => value + 1)
                    }
                >
                    Next
                </button>
            </div>

            {dialog && (
                <Dialog
                    title={
                        dialog.kind === "invoice"
                            ? "Invoice"
                            : dialog.kind === "edit"
                                ? `${dialog.record ? "Edit" : "Add"} ${title}`
                                : label(dialog.action)
                    }

                    onClose={closeDialog}
                    busy={busy || uploading}
                >
                    {error && (
                        <p
                            className="lsa-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}

                    {dialog.kind === "invoice" ? (
                        <InvoiceView
                            invoice={dialog.record}
                        />
                    ) : (
                        <form onSubmit={save}>
                            {!fields.length && (
                                <p>
                                    Confirm{" "}
                                    {label(dialog.action)}
                                    {" for this record?"}
                                </p>
                            )}

                            <AdminFields
                                fields={fields}
                                form={form}

                                editing={
                                    dialog.kind === "edit" &&
                                    !!dialog.record
                                }

                                busy={busy}
                                kind={resource}
                                options={options}
                                onBusyChange={uploadStatus}

                                onChange={(key, value) => {
                                    setForm(previous => {
                                        const next = {
                                            ...previous,
                                            [key]: value
                                        };

                                        if (
                                            key === "hotelId" &&
                                            !dialog.record
                                        ) {
                                            next.roomTypeId = "";
                                            next.assignedTo = "";
                                        }

                                        if (key === "roomId") {
                                            next.assignedTo = "";
                                        }

                                        if (key === "guestId") {
                                            const guest =
                                                lookups.guests?.find(
                                                    item =>
                                                        item._id === value
                                                );

                                            if (guest) {
                                                Object.assign(
                                                    next,
                                                    {
                                                        guestName:
                                                            guest.name,

                                                        guestEmail:
                                                            guest.email,

                                                        guestPhone:
                                                            guest.phone
                                                    }
                                                );
                                            }
                                        }

                                        return next;
                                    });
                                }}
                            />

                            <div className="lsa-form-footer">
                                <button
                                    disabled={
                                        busy ||
                                        uploading ||
                                        !!lookupError
                                    }
                                >
                                    {uploading
                                        ? "Uploading photos…"
                                        : busy
                                            ? "Saving…"
                                            : "Confirm & save"}
                                </button>

                                <button
                                    type="button"
                                    disabled={busy || uploading}
                                    onClick={closeDialog}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </Dialog>
            )}
        </section>
    );
}

function printInvoice() {
    const invoice = document.getElementById("lsa-invoice-print");

    if (!invoice) {
        alert("Invoice content could not be found.");
        return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
        alert("Please allow pop-ups to print the invoice.");
        return;
    }

    printWindow.document.open();
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <title>LuxuryStay Invoice</title>
            <style>
                @page {
                    size: A4;
                    margin: 15mm;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    color: #222;
                    background: #fff;
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    line-height: 1.5;
                }

                h1 {
                    font-size: 28px;
                    margin: 0 0 8px;
                }

                h2, h3 {
                    margin: 12px 0 8px;
                }

                p {
                    margin: 10px 0;
                    overflow-wrap: anywhere;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 18px 0;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                    overflow-wrap: anywhere;
                }

                th {
                    background: #f2f2f2;
                }

                tr {
                    break-inside: avoid;
                }

                dl {
                    width: 300px;
                    max-width: 100%;
                    margin-left: auto;
                }

                dl > div {
                    display: flex;
                    justify-content: space-between;
                    gap: 15px;
                    padding: 6px 0;
                    border-bottom: 1px solid #ddd;
                }

                dd {
                    margin: 0;
                    text-align: right;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            ${invoice.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
    };
}

function InvoiceView({ invoice: inv }) {
    const stay = inv.bookingId;

    return (
        <>
            <div
                className="lsa-invoice"
                id="lsa-invoice-print"
            >
                <h1>LuxuryStay</h1>
                <h2>{inv.hotelId?.name}</h2>
                <h3>Invoice {inv.number}</h3>

                <p>
                    {stay?.guestSnapshot?.name}
                    <br />
                    {stay?.guestSnapshot?.email}
                    <br />
                    {stay?.guestSnapshot?.phone}
                </p>

                <p>
                    Booking: {stay?.reference}
                    <br />
                    Stay: {stay?.checkIn?.slice(0, 10)}
                    {" to "}
                    {stay?.checkOut?.slice(0, 10)}
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Unit price</th>
                            <th>Amount</th>
                        </tr>
                    </thead>

                    <tbody>
                        {inv.chargeItems.map(item => (
                            <tr key={item._id}>
                                <td>{item.label}</td>
                                <td>{item.quantity}</td>

                                <td>
                                    {money(item.unitPrice)}
                                </td>

                                <td>
                                    {money(
                                        item.quantity *
                                        item.unitPrice
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <dl>
                    {[
                        ["Subtotal", inv.subtotal],
                        [`Tax (${inv.taxRate}%)`, inv.tax],
                        ["Discount", inv.discount],
                        ["Grand total", inv.grandTotal],
                        ["Paid", inv.paid],
                        ["Balance", inv.balance]
                    ].map(([title, amount]) => (
                        <div key={title}>
                            <dt>{title}</dt>
                            <dd>{money(amount)}</dd>
                        </div>
                    ))}
                </dl>

                <h3>Payments</h3>

                {inv.payments.length ? (
                    inv.payments.map(payment => (
                        <p key={payment._id}>
                            {display(
                                payment.paidAt,
                                "createdAt"
                            )}
                            {" · "}
                            {payment.method}
                            {" · "}
                            {money(payment.amount)}
                            {" · "}
                            {payment.reference}
                        </p>
                    ))
                ) : (
                    <p>No payments recorded.</p>
                )}

                <p>
                    Tax is calculated on subtotal;
                    discount is deducted after tax.
                </p>
            </div>

            <button
    type="button"
    onClick={printInvoice}
>
    Print / save as PDF
</button>
        </>
    );
}