import { Route } from "react-router-dom";

import GuestPage from "./GuestPage.jsx";
import GuestInvoicePage from "./GuestInvoicePage.jsx";
import NewBookingPage from "./NewBookingPage.jsx";

export function guestRoutes() {
    return [
        <Route
            key="guest-new-booking"
            path="new-booking"
            element={<NewBookingPage />}
        />,

        <Route
            key="guest-bookings"
            path="bookings"
            element={<GuestPage resource="bookings" />}
        />,

        <Route
            key="guest-booking-details"
            path="bookings/:bookingId"
            element={<GuestPage resource="detail" />}
        />,

        <Route
            key="guest-services"
            path="services"
            element={<GuestPage resource="services" />}
        />,

        <Route
            key="guest-maintenance"
            path="maintenance"
            element={<GuestPage resource="maintenance" />}
        />,

        <Route
            key="guest-invoices"
            path="invoices"
            element={<GuestPage resource="invoices" />}
        />,

        <Route
            key="guest-invoice"
            path="invoices/:invoiceId"
            element={<GuestInvoicePage />}
        />,

        <Route
            key="guest-notifications"
            path="notifications"
            element={<GuestPage resource="notifications" />}
        />
    ];
}