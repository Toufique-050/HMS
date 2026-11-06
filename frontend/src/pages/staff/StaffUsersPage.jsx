import { useEffect, useState } from "react";
import http, { errorMessage } from "../../api/http.js";

const empty = {
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "Receptionist",
    hotelId: "",
    isActive: true
};

export default function StaffUsersPage() {
    const [users, setUsers] = useState([]);
    const [hotels, setHotels] = useState([]);

    const [form, setForm] = useState(empty);
    const [editing, setEditing] = useState(null);

    const [hotel, setHotel] = useState({
        name: "",
        location: ""
    });

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);

    async function load() {
        const [staffResponse, hotelsResponse] = await Promise.all([
            http.get(`/users/staff?page=${page}`),
            http.get("/hotels")
        ]);

        setUsers(staffResponse.data.users);
        setPages(staffResponse.data.pages);
        setHotels(hotelsResponse.data.hotels);
    }

    useEffect(() => {
        load().catch(error => {
            setError(errorMessage(error));
        });
    }, [page]);

    const change = event => {
        setForm({
            ...form,
            [event.target.name]: event.target.value
        });
    };

    async function save(event) {
        event.preventDefault();

        setBusy(true);
        setError("");
        setMessage("");

        try {
            if (editing) {
                await http.patch(`/users/staff/${editing}`, {
                    name: form.name,
                    phone: form.phone,
                    role: form.role,
                    hotelId: form.hotelId,
                    isActive: form.isActive
                });
            } else {
                await http.post("/users/staff", {
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    password: form.password,
                    role: form.role,

                    hotelId: form.role === "Admin"
                        ? null
                        : form.hotelId
                });
            }

            setForm(empty);
            setEditing(null);

            await load();

            setMessage("Staff saved successfully");
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function addHotel(event) {
        event.preventDefault();

        setBusy(true);
        setError("");
        setMessage("");

        try {
            await http.post("/hotels", hotel);

            setHotel({
                name: "",
                location: ""
            });

            await load();

            setMessage("Hotel created");
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

   const editableRoles = [
    "Manager",
    "Receptionist",
    "Housekeeping"
];
    return (
        <section>
            <h1>Staff & hotels</h1>

            {error && (
                <p className="error" role="alert">{error}</p>
            )}

            {message && <p role="status">{message}</p>}

            <form className="card" onSubmit={addHotel}>
                <h2>Create hotel for staff assignment</h2>

                <label>
                    Hotel name
                    <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={hotel.name}
                        onChange={event => setHotel({
                            ...hotel,
                            name: event.target.value
                        })}
                    />
                </label>

                <label>
                    Location
                    <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={hotel.location}
                        onChange={event => setHotel({
                            ...hotel,
                            location: event.target.value
                        })}
                    />
                </label>

                <button disabled={busy}>Add hotel</button>
            </form>

            <form className="card" onSubmit={save}>
                <h2>{editing ? "Edit staff" : "Create staff"}</h2>

                <label>
                    Name
                    <input
                        name="name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={form.name}
                        onChange={change}
                    />
                </label>

                {!editing && (
                    <>
                        <label>
                            Email
                            <input
                                name="email"
                                type="email"
                                required
                                maxLength={254}
                                value={form.email}
                                onChange={change}
                            />
                        </label>

                        <label>
                            Initial password
                            <input
                                name="password"
                                type="password"
                                required
                                minLength={5}
                                maxLength={72}
                                autoComplete="new-password"
                                value={form.password}
                                onChange={change}
                            />
                        </label>
                    </>
                )}

                <label>
                    Phone
                    <input
                        name="phone"
                        type="tel"
                        maxLength={30}
                        value={form.phone}
                        onChange={change}
                    />
                </label>

                <label>
                    Role
                    <select
                        name="role"
                        value={form.role}
                        onChange={change}
                    >
                        {editableRoles.map(role => (
                            <option key={role}>{role}</option>
                        ))}
                    </select>
                </label>

                {form.role !== "Admin" && (
                    <label>
                        Assigned hotel

                        <select
                            name="hotelId"
                            value={form.hotelId || ""}
                            required
                            onChange={change}
                        >
                            <option value="">Select hotel</option>

                            {hotels
                                .filter(item => item.isActive)
                                .map(item => (
                                    <option
                                        key={item._id}
                                        value={item._id}
                                    >
                                        {item.name}
                                    </option>
                                ))}
                        </select>
                    </label>
                )}

                {editing && (
                    <label className="check">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={event => setForm({
                                ...form,
                                isActive: event.target.checked
                            })}
                        />
                        Account active
                    </label>
                )}

                <button disabled={busy}>
                    {editing ? "Save changes" : "Create staff"}
                </button>

                {editing && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            setEditing(null);
                            setForm(empty);
                        }}
                    >
                        Cancel
                    </button>
                )}
            </form>

            <div className="card table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Name/email</th>
                            <th>Role</th>
                            <th>Hotel</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        {users.map(item => (
                            <tr key={item.id}>
                                <td>
                                    {item.name}
                                    <br />
                                    {item.email}
                                </td>

                                <td>{item.role}</td>

                                <td>
                                    {item.role === "Admin"
                                        ? "All hotels"
                                        : hotels.find(
                                            h => h._id === item.hotelId
                                        )?.name ||
                                          "Assigned hotel unavailable"}
                                </td>

                                <td>
                                    {item.isActive
                                        ? "Active"
                                        : "Inactive"}
                                </td>

                                <td>
                                    {item.role !== "Admin" ? (
                                        <button
                                            disabled={busy}
                                            onClick={() => {
                                                setEditing(item.id);
                                                setForm({
                                                    ...empty,
                                                    ...item
                                                });
                                            }}
                                        >
                                            Edit
                                        </button>
                                    ) : (
                                        "Protected"
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>

                <span>Page {page} of {pages}</span>

                <button
                    disabled={page >= pages}
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </div>
        </section>
    );
}