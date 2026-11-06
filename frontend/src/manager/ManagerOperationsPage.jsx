import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import http, { errorMessage } from "../api/http.js";
import { columns as frontDeskColumns, money, label, localNow } from "../receptionist/config.js";
import { forms, titles, keys } from "./config.js";
import useHotelRealtime from "../hooks/useHotelRealtime.js";
// NOTE: agar yeh path red ho to ImageUploadField.jsx ka sahi folder likh do
import ImageUploadField from "../admin/ImageUploadField.jsx";

const api = "/manager";
const taskResources = ["housekeeping", "maintenance"];
const catalogColumns = {
    "room-types": [["Type", row => row.name], ["Capacity", row => row.capacity], ["Nightly rate", row => money(row.baseRate)], ["Amenities", row => row.amenities?.join(", ")], ["Active", row => row.isActive ? "Yes" : "No"]],
    rooms: frontDeskColumns.rooms,
    services: [["Service", row => row.name], ["Category", row => label(row.category)], ["Unit price", row => money(row.price)], ["Active", row => row.isActive ? "Yes" : "No"]],
    housekeeping: frontDeskColumns.housekeeping,
    maintenance: frontDeskColumns.maintenance
};
function Editor({ title, busy, onClose, children }) {
    const dialog = useRef(null);
    useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
    return <dialog className="rx-modal" ref={dialog} aria-labelledby="manager-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><div className="rx-modal-heading"><h2 id="manager-editor-title">{title}</h2><button type="button" className="rx-button rx-secondary" disabled={busy} onClick={onClose}>Close</button></div>{children}</dialog>;
}
export default function ManagerOperationsPage({ resource }) {
    const liveRevision = useHotelRealtime();
    const isTask = taskResources.includes(resource), isHotel = resource === "hotel";
    const [result, setResult] = useState(null), [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const [reload, setReload] = useState(0), [page, setPage] = useState(1), [q, setQ] = useState(""), [search, setSearch] = useState(""), [status, setStatus] = useState("");
    const [editor, setEditor] = useState(null), [values, setValues] = useState({}), [formError, setFormError] = useState(""), [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const lock = useRef(false);
    const imageKind = isHotel ? "hotels" : "room-types";
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError("");
        (async () => {
            try {
                const endpoint = isHotel ? "/hotel" : isTask ? `/${resource}` : `/manage/${resource}`;
                const [data, opts] = await Promise.all([
                    http.get(api + endpoint, { signal: controller.signal, params: isHotel ? {} : { page, q: search, ...(isTask ? { status } : { active: status }) } }),
                    http.get(api + "/options", { signal: controller.signal })
                ]);
                if (!controller.signal.aborted) { setResult(data.data); setOptions(opts.data); }
            } catch (caught) { if (!controller.signal.aborted) setError(errorMessage(caught)); }
            finally { if (!controller.signal.aborted) setLoading(false); }
        })();
        return () => controller.abort();
    }, [
        resource,
        isTask,
        isHotel,
        page,
        search,
        status,
        reload,
        liveRevision
    ]);
    

function choices(field, item) {
    if (field.options) {
        return field.options.map(value => [value, label(value)]);
    }

    if (field.source === "housekeepingStaff") {
        return (options?.staff || [])
            .filter(user => user.role === "Housekeeping")
            .map(user => [
                user._id,
                `${user.name} · ${user.role}`
            ]);
    }

    if (field.source === "maintenanceStaff") {
        return (options?.staff || [])
            .filter(user => user.role === "Housekeeping")
            .map(user => [
                user._id,
                `${user.name} · ${user.role}`
            ]);
    }

    if (field.source === "rooms") {
        return (options?.rooms || []).map(room => [
            room._id,
            `Room ${room.roomNumber} · ${room.roomTypeId?.name || ""}`
        ]);
    }

    if (field.source === "roomTypes") {
        const rows = (options?.roomTypes || []).map(type => [
            type._id,
            type.name
        ]);

        if (
            item?.roomTypeId?._id &&
            !rows.some(([key]) => key === item.roomTypeId._id)
        ) {
            rows.push([
                item.roomTypeId._id,
                item.roomTypeId.name
            ]);
        }

        return rows;
    }

    return [];
}


    function open(type, item = null, targetStatus = "") {
        const initial = {};
        if (["create", "edit"].includes(type)) for (const field of forms[resource]) {
            const raw = item?.[field.key];
            initial[field.key] = field.type === "list" ? (raw || []).join("\n") : field.type === "images" ? (Array.isArray(raw) ? raw : []) : field.type === "select" ? String(keys(raw)) : raw ?? field.default ?? (field.type === "datetime-local" ? localNow() : "");
        }
        if (type === "assign") initial.assignedTo = String(keys(item.assignedTo));
        if (type === "status") initial.resolution = "";
        if (type === "readiness") Object.assign(initial, { housekeepingStatus: item.housekeepingStatus, maintenanceStatus: item.maintenanceStatus });
        setValues(initial); setFormError(""); setUploading(false); setEditor({ type, item, targetStatus });
    }
    function close() { if (!lock.current && !uploading) { setEditor(null); setFormError(""); } }
    function input(field) {
        const id = `manager-${field.key}`;
        if (field.type === "images") {
            return <div key={field.key} className="mg-wide-field">
                <p className="mg-image-heading">{field.title}</p>
                <ImageUploadField
                    value={values[field.key]}
                    kind={imageKind}
                    disabled={busy}
                    onBusyChange={setUploading}
                    onChange={value => setValues(current => ({ ...current, [field.key]: value }))}
                />
            </div>;
        }
        const disabled = busy || (editor.type === "edit" && field.immutable);
        const common = { id, "aria-labelledby": `${id}-label`, disabled, required: !field.optional && !["list", "checkbox"].includes(field.type) };
        const update = event => setValues(current => ({ ...current, [field.key]: field.type === "checkbox" ? event.target.checked : event.target.value }));
        return <label key={field.key} className={`rx-field ${["list", "textarea"].includes(field.type) ? "mg-wide-field" : ""} ${field.type === "checkbox" ? "mg-checkbox" : ""}`} htmlFor={id}><span id={`${id}-label`}>{field.title}{field.optional ? " (optional)" : ""}</span>
            {field.type === "checkbox" ? <input {...common} type="checkbox" checked={Boolean(values[field.key])} onChange={update} /> : field.type === "select" ? <select {...common} value={values[field.key] || ""} onChange={update}><option value="">{field.optional ? "Unassigned" : "Choose…"}</option>{choices(field, editor.item).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select> : ["textarea", "list"].includes(field.type) ? <textarea {...common} value={values[field.key] || ""} onChange={update} maxLength={4000} rows={4} /> : <input {...common} type={field.type} value={values[field.key] ?? ""} onChange={update} min={field.min} max={field.max} step={field.step} maxLength={field.type === "text" ? 100 : undefined} />}
        </label>;
    }
    async function save(event) {
        event.preventDefault(); if (lock.current || uploading) return;
        lock.current = true; setBusy(true); setFormError(""); setNotice("");
        try {
            let endpoint, body = {}, method = "post";
            if (["create", "edit"].includes(editor.type)) {
                for (const field of forms[resource]) {
                    const value = values[field.key];
                    body[field.key] = field.type === "images" ? (Array.isArray(value) ? value : []) : field.type === "list" ? String(value || "").split(/\r?\n/).map(text => text.trim()).filter(Boolean) : field.type === "number" ? Number(value) : field.type === "checkbox" ? Boolean(value) : field.type === "datetime-local" ? new Date(value).toISOString() : field.type === "select" && field.optional ? value || null : value || "";
                }
                if (isHotel) { endpoint = "/hotel"; method = "put"; }
                else if (isTask) endpoint = `/${resource}`;
                else { endpoint = `/manage/${resource}${editor.type === "edit" ? `/${editor.item._id}` : ""}`; method = editor.type === "edit" ? "put" : "post"; }
            } else {
                endpoint = `/${resource}/${editor.item._id}/${editor.type}`;
                if (editor.type === "assign") body = { assignedTo: values.assignedTo };
                if (editor.type === "status") body = { status: editor.targetStatus, resolution: values.resolution || "" };
                if (editor.type === "readiness") body = { housekeepingStatus: values.housekeepingStatus, maintenanceStatus: values.maintenanceStatus };
            }
            await http[method](api + endpoint, body);
            setEditor(null); setNotice("Saved successfully. Updated records are being loaded."); setReload(value => value + 1);
        } catch (caught) { setFormError(errorMessage(caught)); }
        finally { lock.current = false; setBusy(false); }
    }
    const stateOptions = resource === "housekeeping" ? ["pending", "in_progress", "completed"] : ["open", "in_progress", "resolved"];
    return <section className="rx-page" aria-busy={loading}>
        <header className="rx-hero"><div><span className="rx-eyebrow">LUXURYSTAY · HOTEL MANAGEMENT</span><h1>{titles[resource]}</h1><p>{options?.hotel.name || "Assigned hotel"}{options?.hotel.location ? ` · ${options.hotel.location}` : ""}</p></div><div className="rx-hero-actions"><button className="rx-button rx-secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button><button className="rx-button" disabled={!options || (isHotel && !result?.item)} onClick={() => open(isHotel ? "edit" : "create", isHotel ? result.item : null)}>{isHotel ? "Edit hotel details" : isTask ? "+ New request" : "+ Add record"}</button></div></header>
        {error && <p className="rx-error" role="alert">{error}</p>}{notice && <p className="rx-success" role="status">{notice}</p>}{loading && <p role="status">Loading your hotel's records…</p>}
        {isHotel && result?.item && <article className="rx-panel"><h2>{result.item.name}</h2><p>{result.item.location}<br />{result.item.address}<br />{result.item.contact}</p><h3>Facilities</h3><p>{result.item.facilities?.join(" · ") || "No facilities added."}</p><div className="mg-photos">{result.item.images?.map((url, index) => <img key={`${url}-${index}`} src={url} alt={`${result.item.name} photo ${index + 1}`} loading="lazy" />)}</div><p className="rx-muted">Hotel activation, staff accounts and system policies remain with Admin.</p></article>}
        {!isHotel && <>
            {resource === "rooms" && <div className="mg-inline-links"><Link to="/manager/bookings">Search availability / create reservation →</Link><Link to="/manager/housekeeping">Assign cleaning →</Link></div>}
            {resource === "room-types" && <p className="rx-muted">Rate changes apply to new reservations. Existing bookings retain their agreed nightly rate. Archive rather than delete records.</p>}
            {isTask && <p className="rx-muted">{resource === "housekeeping" ? "Assign active housekeeping staff, start the task and complete it after cleaning. Room must be vacant for checkout cleaning." : "Assign active manager/housekeeping staff, start the work, then resolve with notes after the issue is fixed."}</p>}
            <form className="rx-toolbar" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(q); }}><label className="rx-search">Search<input value={q} onChange={event => setQ(event.target.value)} maxLength={100} placeholder={isTask ? "Search request notes / issue…" : "Search name / room…"} /></label><label>{isTask ? "Status" : "Active status"}<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="">All</option>{(isTask ? stateOptions.map(value => [value, label(value)]) : [["true", "Active"], ["false", "Archived"]]).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label><button className="rx-button" disabled={loading}>Search</button></form>
            {result && <div className="rx-panel"><div className="rx-table-wrap" role="region" aria-label={titles[resource]} tabIndex={0}><table className="rx-table"><thead><tr>{catalogColumns[resource].map(([name]) => <th scope="col" key={name}>{name}</th>)}<th scope="col">Actions</th></tr></thead><tbody>{result.items.length ? result.items.map(item => <tr key={item._id}>{catalogColumns[resource].map(([name, render]) => <td key={name}>{render(item) ?? "—"}</td>)}<td><div className="rx-actions">
                {!isTask && <button onClick={() => open("edit", item)}>Edit</button>}
                {resource === "rooms" && <button onClick={() => open("readiness", item)}>Room readiness</button>}
                {isTask && !["completed", "resolved"].includes(item.status) && <><button onClick={() => open("assign", item)}>Assign / reassign</button>{["pending", "open"].includes(item.status) && <button onClick={() => open("status", item, "in_progress")}>Start work</button>}{item.status === "in_progress" && <button onClick={() => open("status", item, resource === "housekeeping" ? "completed" : "resolved")}>{resource === "housekeeping" ? "Complete cleaning" : "Resolve issue"}</button>}</>}
                {isTask && ["completed", "resolved"].includes(item.status) && <span className="mg-badge">Finished</span>}
            </div></td></tr>) : <tr><td colSpan={catalogColumns[resource].length + 1}><div className="rx-empty">No matching records.</div></td></tr>}</tbody></table></div><div className="rx-pagination"><button className="rx-button rx-secondary" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {result.page} of {result.pages} · {result.total} records</span><button className="rx-button rx-secondary" disabled={loading || page >= result.pages} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}
        </>}
        {editor && <Editor busy={busy || uploading} onClose={close} title={editor.type === "readiness" ? "Update room readiness" : editor.type === "assign" ? "Assign hotel staff" : editor.type === "status" ? label(editor.targetStatus) : `${editor.type === "edit" ? "Edit" : "Add"} ${titles[resource]}`}><form className="rx-form" onSubmit={save}><fieldset disabled={busy}><div className="rx-form-grid">
            {["create", "edit"].includes(editor.type) && forms[resource].map(input)}
            {editor.type === "assign" && input({ key: "assignedTo", title: "Assign staff", type: "select", source: resource === "housekeeping" ? "housekeepingStaff" : "maintenanceStaff" })}
            {editor.type === "status" && resource === "maintenance" && editor.targetStatus === "resolved" && input({ key: "resolution", title: "Resolution notes", type: "textarea" })}
            {editor.type === "readiness" && <>{input({ key: "housekeepingStatus", title: "Cleaning status", type: "select", options: ["clean", "dirty", "cleaning"] })}{input({ key: "maintenanceStatus", title: "Maintenance status", type: "select", options: ["operational", "out_of_service"] })}</>}
        </div>
        {editor.type === "status" && <p>Confirm the actual work has reached this stage. Completing cleaning can make a room ready only when other unfinished cleaning tasks are cleared.</p>}
        {editor.type === "readiness" && <p>Unfinished cleaning and unresolved maintenance block readiness. Occupied rooms or rooms with active reservations cannot be removed from service.</p>}
        {formError && <p className="rx-error" role="alert">{formError}</p>}<div className="rx-form-footer"><button type="button" className="rx-button rx-secondary" disabled={busy || uploading} onClick={close}>Cancel</button><button className="rx-button" disabled={busy || uploading}>{busy ? "Saving…" : uploading ? "Uploading…" : "Confirm & save"}</button></div></fieldset></form></Editor>}
    </section>;
}