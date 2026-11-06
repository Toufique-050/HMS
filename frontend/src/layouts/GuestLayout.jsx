import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import StaffLayout from "./StaffLayout.jsx";

export default function GuestLayout() {
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const path = sessionStorage.getItem(
                "luxurystay_booking_return"
            );

            sessionStorage.removeItem(
                "luxurystay_booking_return"
            );

            if (
                path &&
                /^\/rooms\/[a-f\d]{24}\?/i.test(path)
            ) {
                navigate(path, { replace: true });
            }
        } catch {
            // Storage restrictions must not break the dashboard.
        }
    }, [navigate]);

    return <StaffLayout />;
}