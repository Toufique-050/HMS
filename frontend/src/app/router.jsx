import {
    Routes,
    Route,
    Navigate,
    Link
} from "react-router-dom";

import { ROLES } from "../constants/roles.js";

import ProtectedRoute from
    "../components/common/ProtectedRoute.jsx";

import ReservationApprovals from
    "../components/bookings/ReservationApprovals.jsx";

import PublicLayout from "../layouts/PublicLayout.jsx";
import StaffLayout from "../layouts/StaffLayout.jsx";

import GuestLayout from "../guest/GuestLayout.jsx";
import GuestPage from "../guest/GuestPage.jsx";
import { guestRoutes } from "../guest/routes.jsx";

import ManagerLayout from "../manager/ManagerLayout.jsx";
import ManagerPage from "../manager/ManagerPage.jsx";
import { managerRoutes } from "../manager/routes.jsx";

import ReceptionistLayout from
    "../receptionist/ReceptionistLayout.jsx";

import ReceptionistPage from
    "../receptionist/ReceptionistPage.jsx";

import InvoicePrintPage from
    "../receptionist/InvoicePrintPage.jsx";

import {
    menu as receptionistMenu
} from "../receptionist/config.js";

import AdminLayout from "../admin/adminLayout.jsx";
import AdminPage from "../admin/AdminPage.jsx";
import AdminReports from "../admin/AdminReports.jsx";

import {
    menu as adminMenu
} from "../admin/config.js";

import HousekeepingLayout from
    "../housekeeping/HousekeepingLayout.jsx";

import HousekeepingPage from
    "../housekeeping/HousekeepingPage.jsx";

import {
    housekeepingRoutes
} from "../housekeeping/routes.jsx";

import HomePage from "../pages/public/HomePage.jsx";
import HotelsPage from "../pages/public/HotelsPage.jsx";

import HotelDetailsPage from
    "../pages/public/HotelDetailsPage.jsx";

import RoomsPage from "../pages/public/RoomsPage.jsx";

import RoomDetailsPage from
    "../pages/public/RoomDetailsPage.jsx";

import AboutPage from "../pages/public/AboutPage.jsx";
import ContactPage from "../pages/public/ContactPage.jsx";

import PoliciesFaqPage from
    "../pages/public/PoliciesFaqPage.jsx";

import LoginPage from "../pages/auth/LoginPage.jsx";
import RegisterPage from "../pages/auth/RegisterPage.jsx";

import StaffDashboardPage from
    "../pages/staff/StaffDashboardPage.jsx";

import MyProfilePage from
    "../pages/guest/MyProfilePage.jsx";

function getRoleLayout(role) {
    switch (role) {
        case "Admin":
            return <AdminLayout />;

        case "Manager":
            return <ManagerLayout />;

        case "Receptionist":
            return <ReceptionistLayout />;

        case "Housekeeping":
            return <HousekeepingLayout />;

        case "Guest":
            return <GuestLayout />;

        default:
            return <StaffLayout />;
    }
}

function getRoleDashboard(role) {
    switch (role) {
        case "Admin":
            return <AdminReports overview />;

        case "Manager":
            return <ManagerPage resource="dashboard" />;

        case "Receptionist":
            return (
                <ReceptionistPage resource="dashboard" />
            );

        case "Housekeeping":
            return (
                <HousekeepingPage resource="dashboard" />
            );

        case "Guest":
            return <GuestPage resource="dashboard" />;

        default:
            return <StaffDashboardPage />;
    }
}

export default function AppRoutes() {
    return (
        <Routes>
            <Route element={<PublicLayout />}>
                <Route
                    path="/"
                    element={<HomePage />}
                />

                <Route
                    path="/hotels"
                    element={<HotelsPage />}
                />

                <Route
                    path="/hotels/:hotelId"
                    element={<HotelDetailsPage />}
                />

                <Route
                    path="/rooms"
                    element={<RoomsPage />}
                />

                <Route
                    path="/rooms/:roomId"
                    element={<RoomDetailsPage />}
                />

                <Route
                    path="/about"
                    element={<AboutPage />}
                />

                <Route
                    path="/contact"
                    element={<ContactPage />}
                />

                <Route
                    path="/policies"
                    element={<PoliciesFaqPage />}
                />

                <Route
                    path="/faq"
                    element={
                        <Navigate
                            to="/policies"
                            replace
                        />
                    }
                />

                <Route
                    path="/login"
                    element={<LoginPage />}
                />

                <Route
                    path="/register"
                    element={<RegisterPage />}
                />
            </Route>

            {ROLES.map(role => (
                <Route
                    key={role}
                    element={
                        <ProtectedRoute
                            allowedRoles={[role]}
                        />
                    }
                >
                    <Route
                        path={`/${role.toLowerCase()}`}
                        element={getRoleLayout(role)}
                    >
                        <Route
                            index
                            element={
                                <Navigate
                                    to="dashboard"
                                    replace
                                />
                            }
                        />

                        <Route
                            path="dashboard"
                            element={getRoleDashboard(role)}
                        />

                        <Route
                            path="profile"
                            element={<MyProfilePage />}
                        />

                       {role === "Admin" && (
    <Route
        path="reservation-approvals"
        element={<ReservationApprovals />}
    />
)}

                        {role === "Guest" &&
                            guestRoutes()}

                        {role === "Manager" &&
                            managerRoutes()}

                        {role === "Housekeeping" &&
                            housekeepingRoutes()}

                        {role === "Receptionist" &&
                            receptionistMenu
                                .filter(
                                    ([path]) =>
                                        path !== "dashboard"
                                )
                                .map(([path]) => (
                                    <Route
                                        key={path}
                                        path={path}
                                        element={
                                            <ReceptionistPage
                                                key={path}
                                                resource={path}
                                            />
                                        }
                                    />
                                ))}

                        {role === "Receptionist" && (
                            <Route
                                path="invoices/:invoiceId/print"
                                element={
                                    <InvoicePrintPage />
                                }
                            />
                        )}

                        {role === "Admin" &&
                            adminMenu
                                .filter(
                                    ([path]) =>
                                        ![
                                            "dashboard",
                                            "reservation-approvals"
                                        ].includes(path)
                                )
                                .map(([path]) => (
                                    <Route
                                        key={path}
                                        path={path}
                                        element={
                                            path === "reports" ? (
                                                <AdminReports />
                                            ) : (
                                                <AdminPage
                                                    key={path}
                                                    resource={path}
                                                />
                                            )
                                        }
                                    />
                                ))}
                    </Route>
                </Route>
            ))}

            <Route element={<PublicLayout />}>
                <Route
                    path="*"
                    element={
                        <main className="lh-page lh-container lh-section">
                            <div className="lh-empty">
                                <h1>Page not found</h1>

                                <Link
                                    className="lh-button"
                                    to="/"
                                >
                                    Return home
                                </Link>
                            </div>
                        </main>
                    }
                />
            </Route>
        </Routes>
    );
}