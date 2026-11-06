import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import http, { errorMessage } from "../api/http.js";
import useHotelRealtime from "../hooks/useHotelRealtime.js";
const checklist = [["linen", "Bed and linen checked"], ["bathroom", "Bathroom cleaned"], ["surfaces", "Surfaces cleaned"], ["floor", "Floor cleaned"], ["bins", "Bins emptied"], ["supplies", "Towels and supplies replenished"]];
const titles = { dashboard: "Your room care workspace", tasks: "My cleaning tasks", maintenance: "Maintenance", notifications: "Notifications" };
const label = value => String(value || "—").replaceAll("_", " ");
const date = value => value ? new Date(value).toLocaleString() : "Not scheduled";
const id = value => String(value?._id || value || "");
export default function HousekeepingPage({ resource }) {
    const { user } = useAuth();
    const [data, setData] = useState(null), [error, setError] = useState(""), [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
    const [page, setPage] = useState(1), [q, setQ] = useState(""), [status, setStatus] = useState(""), [view, setView] = useState("all");
    const [modal, setModal] = useState(null), [rooms, setRooms] = useState([]), [form, setForm] = useState({}), [formError, setFormError] = useState("");
    const dialog = useRef(null), previousFocus = useRef(null);
    const liveRevision = useHotelRealtime();
    useEffect(() => {
        // Unknown resource (e.g. rooms/inventory): never call the API.
        if (!titles[resource]) { setLoading(false); return; }
        const controller = new AbortController(); setLoading(true); setError("");
        const params = resource === "dashboard" ? {} : { page, q, status, ...(resource === "maintenance" ? { view } : {}), ...(resource === "notifications" && view === "unread" ? { unread: "true" } : {}) };
        http.get(`/housekeeping/${resource}`, { params, signal: controller.signal }).then(({ data }) => setData(data)).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [resource, page, q, status, view, refresh, liveRevision]);
    useEffect(() => {
        if (!modal) return;
        previousFocus.current = document.activeElement; dialog.current?.focus();
        const onKey = event => {
            if (event.key === "Escape" && !busy) setModal(null);
            if (event.key === "Tab") {
                const nodes = dialog.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[href]');
                if (!nodes?.length) return;
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        };
        document.addEventListener("keydown", onKey); return () => { document.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
    }, [modal, busy]);
    async function mutate(path, body, inModal = false) {
        setBusy(true); setError(""); setFormError(""); setSuccess("");
        try { await http.post(`/housekeeping/${path}`, body); setSuccess("Saved successfully."); setModal(null); setRefresh(n => n + 1); }
        catch (e) { (inModal ? setFormError : setError)(errorMessage(e)); }
        finally { setBusy(false); }
    }
    async function report() {
        setBusy(true); setError("");
        try { const { data } = await http.get("/housekeeping/options"); setRooms(data.rooms); setForm({ roomId: "", priority: "medium", issue: "" }); setFormError(""); setModal({ kind: "report" }); }
        catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
    }
    function open(kind, item) { setFormError(""); setForm(kind === "complete" ? { checklist: {}, completionNotes: "" } : { workNotes: item.workNotes || "" }); setModal({ kind, item }); }
    function submit(event) {
        event.preventDefault();
        if (modal.kind === "report") mutate("maintenance", form, true);
        else if (modal.kind === "complete") mutate(`tasks/${modal.item._id}/status`, { status: "completed", ...form }, true);
        else mutate(`maintenance/${modal.item._id}/work`, { action: "work-note", workNotes: form.workNotes }, true);
    }
    function taskCard(item) {
        const occupied = item.roomId?.occupancyStatus === "occupied";
        return <article className="hk-card" key={item._id}><div className="hk-top"><span className="rx-eyebrow">ROOM {item.roomId?.roomNumber || "Unavailable"}</span><span className="hk-tag">{label(item.status)}</span></div><h2>Room cleaning</h2><p>Scheduled: {date(item.scheduledAt)}</p><p>{item.notes || "Follow the standard room cleaning checklist."}</p><p>Room: {label(item.roomId?.occupancyStatus)} · {label(item.roomId?.housekeepingStatus)} · {label(item.roomId?.maintenanceStatus)}</p>{occupied && item.status !== "completed" && <p>Room is occupied. Ask your Manager to confirm the room is vacant before updating this task.</p>}{item.completionNotes && <p>Completion notes: {item.completionNotes}</p>}<div className="hk-actions">{item.status === "pending" && <button disabled={busy || occupied} className="rx-button" onClick={() => mutate(`tasks/${item._id}/status`, { status: "in_progress" })}>Start cleaning</button>}{item.status === "in_progress" && <button disabled={busy || occupied} className="rx-button" onClick={() => open("complete", item)}>Complete checklist</button>}</div></article>;
    }
    // All hooks are above, so this early return is safe.
    if (!titles[resource]) return <p className="hk-empty">This page is not available.</p>;
    return <>
        <header className="rx-hero"><div><span className="rx-eyebrow">LUXURYSTAY · HOUSEKEEPING</span><h1>{titles[resource]}</h1><p>{resource === "dashboard" ? `${data?.hotel?.name || "Your assigned hotel"} · Welcome, ${user.name}.` : "Your assigned hotel. Your daily work, in one place."}</p></div><div className="hk-actions"><button className="rx-button rx-secondary" disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}>Refresh</button>{resource === "maintenance" && <button className="rx-button" disabled={busy} onClick={report}>Report an issue</button>}</div></header>
        {error && <p role="alert" className="rx-error">{error}</p>}{success && <p role="status" className="hk-success">{success}</p>}
        {resource !== "dashboard" && <div className="hk-toolbar"><input aria-label="Search notes or message" placeholder="Search notes or message…" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />{resource !== "notifications" && <select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{(resource === "tasks" ? ["pending", "in_progress", "completed"] : ["open", "in_progress", "resolved"]).map(s => <option key={s} value={s}>{label(s)}</option>)}</select>}{resource !== "tasks" && <select aria-label="View" value={view} onChange={e => { setView(e.target.value); setPage(1); }}><option value="all">{resource === "maintenance" ? "Reported by me or assigned to me" : "All notifications"}</option>{resource === "maintenance" ? <><option value="assigned">Assigned to me</option><option value="reported">Reported by me</option></> : <option value="unread">Unread only</option>}</select>}</div>}
        {loading ? <p role="status">Loading your workspace…</p> : !error && data && <>
            {resource === "dashboard" && <><div className="rx-stats">{[["pending", "Pending tasks"], ["inProgress", "Cleaning in progress"], ["completedToday", "Completed today"], ["overdue", "Overdue tasks"], ["assignedMaintenance", "Assigned maintenance"], ["reportedOpen", "My open reports"], ["unread", "Unread notifications"]].map(([key, title]) => <article key={key}><span>{title}</span><strong>{data.stats[key]}</strong></article>)}</div><div className="hk-actions"><Link className="rx-button" to="/housekeeping/tasks">View all my tasks</Link><Link className="rx-button rx-secondary" to="/housekeeping/maintenance">Maintenance reports</Link></div><h2>Upcoming cleaning</h2><div className="hk-list">{data.upcoming.map(taskCard)}</div>{!data.upcoming.length && <p className="hk-empty">No unfinished cleaning tasks assigned. Your Manager assigns new tasks.</p>}</>}
            {resource === "tasks" && <div className="hk-list">{data.items.map(taskCard)}</div>}
            {resource === "maintenance" && <><p>Report room problems here. For work assigned to you, start it and send your work notes. Your Manager reviews and resolves the issue.</p><div className="hk-list">{data.items.map(item => <article key={item._id} className="hk-card"><div className="hk-top"><span className="rx-eyebrow">ROOM {item.roomId?.roomNumber || "Unavailable"}</span><span className="hk-tag">{label(item.status)} · {item.priority}</span></div><h2>Maintenance report</h2><p>{item.issue}</p><p>Assigned to: {item.assignedTo?.name || "Awaiting Manager assignment"}</p>{item.workNotes && <p>Work notes: {item.workNotes}</p>}{item.resolution && <p>Manager resolution: {item.resolution}</p>}<div className="hk-actions">{id(item.assignedTo) === id(user.id || user._id) && item.status === "open" && <button className="rx-button" disabled={busy} onClick={() => mutate(`maintenance/${item._id}/work`, { action: "start" })}>Start assigned work</button>}{id(item.assignedTo) === id(user.id || user._id) && item.status === "in_progress" && <button className="rx-button" disabled={busy} onClick={() => open("work", item)}>Send work notes</button>}</div></article>)}</div></>}
            {resource === "notifications" && <div className="hk-list">{data.items.map(item => <article className="hk-card" key={item._id}><span className="hk-tag">{item.isRead ? "Read" : "Unread"}</span><p>{item.message}</p><small>{date(item.createdAt)}</small>{!item.isRead && <div className="hk-actions"><button className="rx-button rx-secondary" disabled={busy} onClick={() => mutate(`notifications/${item._id}/read`, {})}>Mark as read</button></div>}</article>)}</div>}
            {resource !== "dashboard" && <>{!data.items.length && <p className="hk-empty">No records found for these filters.</p>}<div className="hk-pagination"><button className="rx-button rx-secondary" disabled={page <= 1 || busy} onClick={() => setPage(n => n - 1)}>Previous</button><span>{data.page} / {data.pages}</span><button className="rx-button rx-secondary" disabled={page >= data.pages || busy} onClick={() => setPage(n => n + 1)}>Next</button></div></>}
        </>}
        {modal && <div className="hk-backdrop"><section className="hk-dialog" role="dialog" aria-modal="true" aria-labelledby="hk-dialog-title" tabIndex={-1} ref={dialog}><h2 id="hk-dialog-title">{modal.kind === "report" ? "Report a room issue" : modal.kind === "complete" ? "Complete cleaning checklist" : "Work notes for Manager"}</h2><form onSubmit={submit}>{modal.kind === "report" ? <><label>Room<select aria-label="Room" required value={form.roomId} onChange={e => setForm({ ...form, roomId: e.target.value })}><option value="">Choose a room</option>{rooms.map(room => <option key={room._id} value={room._id}>Room {room.roomNumber} · Floor {room.floor}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{["low", "medium", "high", "urgent"].map(v => <option key={v}>{v}</option>)}</select></label><label>Issue<textarea required maxLength={2000} value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} /></label></> : modal.kind === "complete" ? <><div className="hk-checklist">{checklist.map(([key, text]) => <label key={key}><input type="checkbox" required checked={!!form.checklist[key]} onChange={e => setForm({ ...form, checklist: { ...form.checklist, [key]: e.target.checked } })} />{text}</label>)}</div><label>Completion notes (optional)<textarea maxLength={2000} value={form.completionNotes} onChange={e => setForm({ ...form, completionNotes: e.target.value })} /></label></> : <label>Work performed<textarea required maxLength={2000} value={form.workNotes} onChange={e => setForm({ workNotes: e.target.value })} /></label>}{formError && <p role="alert" className="rx-error">{formError}</p>}<div className="hk-actions"><button type="button" className="rx-button rx-secondary" disabled={busy} onClick={() => setModal(null)}>Cancel</button><button className="rx-button" disabled={busy}>{busy ? "Saving…" : modal.kind === "complete" ? "Confirm completion" : "Submit"}</button></div></form></section></div>}
    </>;
}
