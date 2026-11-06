import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import useAuth from "./useAuth.js";
import { TOKEN_KEY } from "../api/http.js";

const staffRoles = new Set([
    "Admin",
    "Manager",
    "Receptionist",
    "Housekeeping"
]);

export default function useHotelRealtime() {
    const { user } = useAuth();
    const [revision, setRevision] = useState(0);

    const userId = user?.id;
    const role = user?.role;
    const hotelId = user?.hotelId;

    useEffect(() => {
        if (!userId || !staffRoles.has(role)) {
            return;
        }

        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) return;

        let refreshTimer;

        const scheduleRefresh = () => {
            clearTimeout(refreshTimer);

            // Combine updates arriving close together.
            refreshTimer = setTimeout(() => {
                setRevision(value => value + 1);
            }, 300);
        };

        const socket = io(
            import.meta.env.VITE_SOCKET_URL ||
                window.location.origin,
            {
                autoConnect: false,
                auth: { token },
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000
            }
        );

        const onHotelUpdate = update => {
            if (
                role === "Admin" ||
                String(update?.hotelId) === String(hotelId)
            ) {
                scheduleRefresh();
            }
        };

        // Refresh after reconnecting, including missed updates.
        socket.on("connect", scheduleRefresh);
        socket.on("hotel:updated", onHotelUpdate);

        socket.connect();

        return () => {
            clearTimeout(refreshTimer);
            socket.off("connect", scheduleRefresh);
            socket.off("hotel:updated", onHotelUpdate);
            socket.disconnect();
        };
    }, [userId, role, hotelId]);

    return revision;
}