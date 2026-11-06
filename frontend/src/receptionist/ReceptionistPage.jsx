import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import http, { errorMessage } from "../api/http.js";
import { columns, titles, statuses, money, date, label, localNow, hotelToday } from "./config.js";
import useHotelRealtime from "../hooks/useHotelRealtime.js";

function Field({ name, title, values, setValues, type = "text", options, required = true, ...props }) {
    const id = `rx-field-${name}`;
    return <label className="rx-field" htmlFor={id}><span>{title}{!required && " (optional)"}</span>
        {options ? <select id={id} value={values[name] ?? ""} required={required} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} {...props}>
            <option value="">Select {title.toLowerCase()}</option>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
        </select> : type === "textarea" ? <textarea id={id} value={values[name] ?? ""} required={required} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} {...props} /> :
            <input id={id} type={type} value={values[name] ?? ""} required={required} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} {...props} />}
    </label>;
}

function Modal({ title, busy, onClose, children }) {
    const ref = useRef(null);
    useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
    return <dialog className="rx-modal" ref={ref} aria-labelledby="rx-modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
        <div className="rx-modal-heading"><h2 id="rx-modal-title">{title}</h2><button type="button" className="rx-button rx-secondary" disabled={busy} onClick={onClose}>Close</button></div>
        {children}
    </dialog>;
}

function Table({ resource, items, onAction, workspace = "receptionist" }) {
    return <div className="rx-table-wrap" tabIndex={0} role="region" aria-label={`${titles[resource] || resource} records`}><table className="rx-table">
        <thead><tr>{columns[resource].map(([name]) => <th scope="col" key={name}>{name}</th>)}<th scope="col">Actions</th></tr></thead>
        <tbody>{items.length ? items.map(item => <tr key={item._id}>{columns[resource].map(([name, render]) => <td key={name}>{render(item) ?? "—"}</td>)}<td><div className="rx-actions">
            {resource === "bookings" && <>
                <button onClick={() => onAction("details", item)}>Details</button>
                {item.status === "confirmed" && <><button onClick={() => onAction("check-in", item)}>Check in</button><button onClick={() => onAction("cancel", item)}>Cancel</button>{date(item.checkIn) < hotelToday() && <button onClick={() => onAction("no-show", item)}>No-show</button>}</>}
                {item.status === "checked_in" && <button onClick={() => onAction("check-out", item)}>Check out</button>}
                {["confirmed", "checked_in"].includes(item.status) && <><button onClick={() => onAction("change-room", item)}>Change room</button><button onClick={() => onAction("extend", item)}>Extend</button></>}
            </>}
            {resource === "guests" && ["confirmed", "checked_in"].includes(item.status) && <button onClick={() => onAction("guest", item)}>Edit details</button>}
            {resource === "invoices" && <><Link to={`/${workspace}/invoices/${item._id}/print`}>View / print</Link>{item.balance > 0 && !["cancelled", "no_show"].includes(item.bookingId?.status) && <button onClick={() => onAction("payment", item)}>Record payment</button>}<button onClick={() => onAction("email", item)}>Email invoice</button>{workspace === "manager" && ["confirmed", "checked_in"].includes(item.bookingId?.status) && <button onClick={() => onAction("discount", item)}>Adjust discount</button>}</>}
            {resource === "service-requests" && <>{item.status === "pending" && <button onClick={() => onAction("accept-service", item)}>Accept</button>}{item.status === "accepted" && <button onClick={() => onAction("complete-service", item)}>Complete & bill</button>}{["pending", "accepted"].includes(item.status) && <button onClick={() => onAction("cancel-service", item)}>Cancel</button>}</>}
            {resource === "notifications" && !item.isRead && <button onClick={() => onAction("read", item)}>Mark read</button>}
            {["rooms", "housekeeping", "maintenance"].includes(resource) && <span className="rx-muted">View only</span>}
        </div></td></tr>) : <tr><td colSpan={columns[resource].length + 1}><div className="rx-empty">No matching records.</div></td></tr>}</tbody>
    </table></div>;
}

export default function ReceptionistPage({ resource, workspace = "receptionist" }) {
    const api = `/${workspace}`;
    const [data, setData] = useState(null), [options, setOptions] = useState(null);
    const [error, setError] = useState(""), [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
    const [page, setPage] = useState(1), [q, setQ] = useState(""), [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [modal, setModal] = useState(null), [values, setValues] = useState({});
    const [busy, setBusy] = useState(false), [formError, setFormError] = useState("");
    const [available, setAvailable] = useState(null), [searching, setSearching] = useState(false);
    const liveRevision = useHotelRealtime();
    const saving = useRef(false), searchVersion = useRef(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError("");
        async function load() {
            try {
                const [result, opts] = await Promise.all([
                    http.get(`${api}/${resource}`, { signal: controller.signal, params: resource === "dashboard" ? {} : { page, q: search, status } }),
                    http.get(`${api}/options`, { signal: controller.signal })
                ]);
                if (!controller.signal.aborted) { setData(result.data); setOptions(opts.data); }
            } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
            finally { if (!controller.signal.aborted) setLoading(false); }
        }
        load(); return () => controller.abort();
    }, [
        resource,
        workspace,
        page,
        search,
        status,
        reload,
        liveRevision
    ]);

    function open(type, item = null) {
        setFormError(""); setAvailable(null); searchVersion.current += 1; setSearching(false);
        const initial = { checkIn: hotelToday(), checkOut: "", guests: "1", guestName: "", guestPhone: "", guestEmail: "", scheduledAt: localNow(), quantity: "1", priority: "medium", notes: "" };
        if (type === "guest") Object.assign(initial, item.guestSnapshot);
        if (type === "payment") Object.assign(initial, { amount: item.balance, method: "cash", reference: "", key: crypto.randomUUID() });
        if (type === "discount") initial.discount = item.discount || 0;
        setValues(initial); setModal({ type, item });
    }

    function close() { if (!saving.current) { searchVersion.current += 1; setModal(null); setAvailable(null); setFormError(""); } }

    function setBookingValues(updater) {
        setValues(updater); searchVersion.current += 1; setAvailable(null); setSearching(false);
    }

    async function findRooms(e) {
        e.preventDefault();
        const version = ++searchVersion.current;
        setSearching(true); setFormError(""); setAvailable(null);
        setValues(v => ({ ...v, roomId: "" }));
        try {
            const result = await http.get(`${api}/availability`, { params: { checkIn: values.checkIn, checkOut: values.checkOut, guests: values.guests } });
            if (version === searchVersion.current) setAvailable(result.data);
        } catch (err) { if (version === searchVersion.current) setFormError(errorMessage(err)); }
        finally { if (version === searchVersion.current) setSearching(false); }
    }

    async function submit(e) {
        e.preventDefault(); if (saving.current) return;
        saving.current = true; setBusy(true); setFormError(""); setNotice("");
        try {
            const { type, item } = modal;
            let url, body, method = "post";
            if (type === "booking") {
                if (!available || !values.roomId) throw new Error("availability");
                url = `${api}/bookings`;
                body = { roomId: values.roomId, checkIn: values.checkIn, checkOut: values.checkOut, guests: Number(values.guests), guestName: values.guestName, guestPhone: values.guestPhone, guestEmail: values.guestEmail || "" };
            } else if (type === "housekeeping") {
                url = `${api}/housekeeping`; body = { roomId: values.roomId, scheduledAt: new Date(values.scheduledAt).toISOString(), notes: values.notes || "" };
            } else if (type === "maintenance") {
                url = `${api}/maintenance`; body = { roomId: values.roomId, issue: values.issue, priority: values.priority };
            } else if (type === "service") {
                url = `${api}/service-requests`; body = { bookingId: values.bookingId, serviceId: values.serviceId, quantity: Number(values.quantity), scheduledAt: new Date(values.scheduledAt).toISOString(), notes: values.notes || "" };
            } else if (type === "guest") {
                method = "put"; url = `${api}/guests/${item._id}`; body = { name: values.name, phone: values.phone, email: values.email || "" };
            } else {
                let operation = type;
                body = {};
                if (type === "discount") body = { discount: Number(values.discount) };
                if (type === "check-in") body = { keyReference: values.keyReference };
                if (type === "extend") body = { checkOut: values.checkOut };
                if (type === "change-room") body = { roomId: values.roomId };
                if (type === "payment") body = { amount: Number(values.amount), method: values.method, reference: values.reference || "", key: values.key };
                if (type.endsWith("-service")) { operation = "status"; body = { status: ({ "accept-service": "accepted", "complete-service": "completed", "cancel-service": "cancelled" })[type] }; }
                url = `${api}/${resource}/${item._id}/${operation}`;
            }
            const result = await http[method](url, body);
            setModal(null); setAvailable(null);
            setNotice(result.data.item?.message || "Saved successfully. The latest hotel records are being loaded.");
            setReload(v => v + 1);
        } catch (err) {
            setFormError(err.message === "availability" ? "Search availability and select a room first." : errorMessage(err));
        } finally { saving.current = false; setBusy(false); }
    }

    const f = (name, title, props = {}) => <Field key={name} name={name} title={title} values={values} setValues={setValues} {...props} />;
    const roomOptions = (options?.rooms || []).map(room => [room._id, `Room ${room.roomNumber} · ${room.roomTypeId?.name || ""} · ${room.housekeepingStatus}`]);
    const selectedRoom = available?.items.find(room => room._id === values.roomId);
    const modalTitles = { booking: "New walk-in reservation", guest: "Edit reservation guest", service: "New guest service", housekeeping: "Request cleaning", maintenance: "Report maintenance", discount: "Adjust invoice discount", payment: "Record payment", "check-in": "Check in guest", "check-out": "Check out guest", "change-room": "Change allocated room", extend: "Extend reservation", cancel: "Cancel reservation", "no-show": "Record no-show", email: "Email invoice", read: "Mark notification read", "accept-service": "Accept service", "complete-service": "Complete service and add charge", "cancel-service": "Cancel service", details: "Reservation details" };

    return <section className="rx-page" aria-busy={loading}>
        <header className="rx-hero"><div><span className="rx-eyebrow">{workspace === "manager" ? "LUXURYSTAY · HOTEL MANAGEMENT" : "LUXURYSTAY · FRONT DESK"}</span><h1>{titles[resource]}</h1><p>{options?.hotel.name || "Assigned hotel"}{options?.hotel.location ? ` · ${options.hotel.location}` : ""}</p></div><div className="rx-hero-actions">
            <button className="rx-button rx-secondary" disabled={loading} onClick={() => setReload(v => v + 1)}>Refresh</button>
            {resource === "bookings" && <button className="rx-button" disabled={!options} onClick={() => open("booking")}>+ Walk-in booking</button>}
            {["housekeeping", "maintenance", "service-requests"].includes(resource) && <button className="rx-button" disabled={!options} onClick={() => open(resource === "service-requests" ? "service" : resource)}>+ {resource === "maintenance" ? "Report issue" : "New request"}</button>}
        </div></header>

        {error && <p role="alert" className="rx-error">{error}</p>}{notice && <p role="status" className="rx-success">{notice}</p>}{loading && <p role="status" className="rx-muted">Loading hotel records…</p>}

        {!loading && data && resource === "dashboard" && <>
            <div className="rx-stats">{[["Active rooms", data.stats.totalRooms], ["Occupied rooms", data.stats.occupiedRooms], ["Ready now", data.stats.readyRooms], ["Pending arrivals", data.stats.pendingArrivals], ["Pending departures", data.stats.pendingDepartures], ["Outstanding balance", money(data.stats.outstandingBalance)]].map(([name, value]) => <article className="rx-stat" key={name}><span>{name}</span><strong>{value}</strong></article>)}</div>
            <p className="rx-muted">Hotel date: {data.date} · Ready now indicates current readiness, not future date availability. Balance covers all outstanding hotel invoices.</p>
            {data.stats.overdueStays > 0 && <p className="rx-error">{data.stats.overdueStays} overdue stay(s). Extend the reservation and settle billing before checkout.</p>}
            <div className="rx-shortcuts"><Link to={`/${workspace}/bookings`}>Manage reservations →</Link><Link to={`/${workspace}/rooms`}>Find a room →</Link><Link to={`/${workspace}/invoices`}>Record payments →</Link></div>
            <section className="rx-panel"><h2>Today's pending arrivals</h2><p className="rx-muted">Up to 10 records. Open Reservations to manage guests.</p><Table workspace={workspace} resource="bookings" items={data.arrivals} onAction={() => { window.location.assign(`/${workspace}/bookings`); }} /></section>
            <section className="rx-panel"><h2>Today's pending departures</h2><Table workspace={workspace} resource="bookings" items={data.departures} onAction={() => { window.location.assign(`/${workspace}/bookings`); }} /></section>
        </>}

        {resource !== "dashboard" && <>
            {resource === "rooms" && <div className="rx-panel rx-intro"><h2>Find a room for the guest's stay</h2><p>Use Walk-in booking to search dates and capacity, see the price estimate and reserve an available room.</p><button className="rx-button" disabled={!options} onClick={() => open("booking")}>Search availability / book</button></div>}
            {resource === "guests" && <p className="rx-muted">One guest-details record per reservation, including walk-ins. Edit active reservations here. Login accounts and historical invoice identities remain separate.</p>}
            {["housekeeping", "maintenance"].includes(resource) && <p className="rx-muted">Request and track work here. Staff assignment and completion are handled by the manager and operational teams.</p>}
            <form className="rx-toolbar" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(q); }}><label className="rx-search">Search<input aria-label={`Search ${titles[resource]}`} value={q} maxLength={100} onChange={e => setQ(e.target.value)} placeholder={resource === "invoices" ? "Invoice number" : "Search records…"} /></label>{statuses[resource] && <label>Status<select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}><option value="">All statuses</option>{statuses[resource].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>}<button className="rx-button" disabled={loading}>Search</button></form>
            {data && <div className="rx-panel"><Table workspace={workspace} resource={resource} items={data.items} onAction={open} /><div className="rx-pagination"><button className="rx-button rx-secondary" disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><span>Page {data.page} of {data.pages} · {data.total} records</span><button className="rx-button rx-secondary" disabled={loading || page >= data.pages} onClick={() => setPage(v => v + 1)}>Next</button></div></div>}
        </>}

        {modal && <Modal title={modalTitles[modal.type]} busy={busy} onClose={close}>
            {modal.type === "details" ? <div className="rx-details"><dl>{[["Reference", modal.item.reference], ["Guest", modal.item.guestSnapshot?.name], ["Phone", modal.item.guestSnapshot?.phone], ["Email", modal.item.guestSnapshot?.email || "—"], ["Room", modal.item.roomId?.roomNumber], ["Stay", `${date(modal.item.checkIn)} → ${date(modal.item.checkOut)}`], ["Nightly agreed rate", money(modal.item.rateSnapshot)], ["Guests", modal.item.guests], ["Status", label(modal.item.status)], ["Key/card reference", modal.item.keyReference || "—"]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></div> : <>
                {modal.type === "booking" && <form onSubmit={findRooms} className="rx-form"><div className="rx-form-grid">
                    <Field name="checkIn" title="Arrival date" type="date" min={hotelToday()} values={values} setValues={setBookingValues} />
                    <Field name="checkOut" title="Departure date" type="date" min={values.checkIn} values={values} setValues={setBookingValues} />
                    <Field name="guests" title="Number of guests" type="number" min="1" max="20" step="1" values={values} setValues={setBookingValues} />
                </div><button className="rx-button" disabled={searching || busy}>{searching ? "Checking…" : "Search available rooms"}</button></form>}
                <form onSubmit={submit} className="rx-form"><fieldset disabled={busy}><div className="rx-form-grid">
                    {modal.type === "booking" && <>{available && f("roomId", "Available room", { options: available.items.map(room => [room._id, `${room.roomNumber} · ${room.roomTypeId.name} · ${money(room.roomTypeId.baseRate)}/night`]) })}{available && available.items.length === 0 && <p>No rooms available for these dates and guest count.</p>}{f("guestName", "Guest full name", { maxLength: 100 })}{f("guestPhone", "Phone number", { type: "tel", maxLength: 30 })}{f("guestEmail", "Email", { type: "email", required: false })}</>}
                    {modal.type === "guest" && <>{f("name", "Full name", { maxLength: 100 })}{f("phone", "Phone number", { type: "tel", maxLength: 30 })}{f("email", "Email", { type: "email", required: false })}</>}
                    {["housekeeping", "maintenance", "change-room"].includes(modal.type) && f("roomId", "Room", { options: roomOptions.filter(([key]) => modal.type !== "change-room" || key !== modal.item.roomId?._id) })}
                    {["housekeeping", "service"].includes(modal.type) && f("scheduledAt", "Scheduled time (your device timezone)", { type: "datetime-local" })}
                    {["housekeeping", "service"].includes(modal.type) && f("notes", "Notes", { type: "textarea", required: false, maxLength: 2000 })}
                    {modal.type === "maintenance" && <>{f("issue", "Describe the issue", { type: "textarea", maxLength: 2000 })}{f("priority", "Priority", { options: ["low", "medium", "high", "urgent"].map(value => [value, label(value)]) })}</>}
                    {modal.type === "service" && <>{f("bookingId", "Checked-in booking", { options: (options?.bookings || []).map(b => [b._id, `${b.reference} · ${b.guestSnapshot?.name}`]) })}{f("serviceId", "Service", { options: (options?.services || []).map(s => [s._id, `${s.name} · ${money(s.price)} each`]) })}{f("quantity", "Quantity", { type: "number", min: "1", max: "100", step: "1" })}</>}
                    {modal.type === "discount" && <>{f("discount", "Total invoice discount (PKR)", { type: "number", min: "0", max: modal.item.subtotal, step: "0.01" })}<p>This sets the total discount, not an additional discount. The total cannot drop below payments already recorded.</p></>}
                    {modal.type === "check-in" && f("keyReference", "Key / card reference", { maxLength: 100 })}
                    {modal.type === "extend" && f("checkOut", "New departure date", { type: "date", min: date(modal.item.checkOut) })}
                    {modal.type === "payment" && <>{f("amount", "Payment amount (PKR)", { type: "number", min: "0.01", max: modal.item.balance, step: "0.01" })}{f("method", "Payment method", { options: [["cash", "Cash"], ["bank", "Bank transfer"], ["card", "Card payment recorded externally"]] })}{f("reference", "Payment reference", { required: false, maxLength: 100 })}</>}
                </div>
                {selectedRoom && modal.type === "booking" && <div className="rx-estimate"><strong>Stay estimate · {available.nights} night(s)</strong><p>Room: {money(selectedRoom.roomTotal)} · Tax ({available.taxRate}%): {money(selectedRoom.tax)}</p><strong>Total: {money(selectedRoom.estimatedTotal)}</strong><p>Final price and room availability are checked again when saving.</p></div>}
                {modal.type === "payment" && <p>Outstanding: {money(modal.item.balance)}. Retry an uncertain payment in this same dialog to preserve its payment key.</p>}
                {modal.type === "change-room" && <p>The backend checks dates, hotel, room capacity and readiness. The agreed nightly rate stays unchanged.</p>}
                {modal.type === "check-out" && <p>Confirm checkout for {modal.item.reference}. Outstanding services must be completed or cancelled. The hotel's balance policy applies. Checkout creates a cleaning task.</p>}
                {modal.type === "cancel" && <p>Cancel {modal.item.reference}? Paid reservations require the hotel's refund process before cancellation.</p>}
                {modal.type === "no-show" && <p>Record this reservation as a no-show? This is allowed after its arrival date.</p>}
                {modal.type === "email" && <p>Send this invoice to the guest email stored on the reservation? Backend SMTP configuration is required.</p>}
                {modal.type === "complete-service" && <p>Mark this service complete and add its saved price to the guest invoice? Each request is billed once.</p>}
                {["accept-service", "cancel-service", "read"].includes(modal.type) && <p>Confirm this update?</p>}
                {formError && <p className="rx-error" role="alert">{formError}</p>}
                <div className="rx-form-footer"><button type="button" className="rx-button rx-secondary" onClick={close} disabled={busy}>Cancel</button><button className="rx-button" disabled={busy || searching || (modal.type === "booking" && !selectedRoom)}>{busy ? "Saving…" : "Confirm & save"}</button></div>
                </fieldset></form>
            </>}
        </Modal>}
    </section>;
}
