import { Navigate, Outlet } from "react-router-dom";

import useAuth from "../../hooks/useAuth.js";
import { dashboardPath } from "../../constants/roles.js";

export default function ProtectedRoute({ allowedRoles }) {
    const {
        user,
        loading,
        connectionError,
        restoreSession
    } = useAuth();

    if (loading) {
        return (
            <p role="status">
                Checking your session…
            </p>
        );
    }

    if (connectionError) {
        return (
            <div role="alert">
                {connectionError}

                <button onClick={restoreSession}>
                    Retry
                </button>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (
        allowedRoles &&
        !allowedRoles.includes(user.role)
    ) {
        return (
            <Navigate
                to={dashboardPath(user.role)}
                replace
            />
        );
    }

    return <Outlet />;
}