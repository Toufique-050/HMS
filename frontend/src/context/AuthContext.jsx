import {
    createContext,
    useEffect,
    useState
} from "react";

import * as authApi from "../features/auth/authApi.js";
import { TOKEN_KEY } from "../api/http.js";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState("");

    const clearAuth = () => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
    };

    async function restoreSession() {
        setLoading(true);
        setConnectionError("");

        if (!localStorage.getItem(TOKEN_KEY)) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const data = await authApi.getMe();
            setUser(data.user);
        } catch (error) {
            setUser(null);

            if (error.response?.status !== 401) {
                setConnectionError(
                    "Cannot reach the API. " +
                    "Check backend/database and retry."
                );
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        restoreSession();

        const expired = () => setUser(null);

        const changed = event => {
            if (event.key === TOKEN_KEY) {
                restoreSession();
            }
        };

        window.addEventListener("auth:expired", expired);
        window.addEventListener("storage", changed);

        return () => {
            window.removeEventListener(
                "auth:expired",
                expired
            );

            window.removeEventListener(
                "storage",
                changed
            );
        };
    }, []);

    async function login(body) {
        const data = await authApi.login(body);

        localStorage.setItem(TOKEN_KEY, data.token);

        setConnectionError("");
        setUser(data.user);

        return data.user;
    }

    async function logout() {
        try {
            await authApi.logout();
        } catch (error) {
            if (error.response?.status !== 401) {
                throw error;
            }
        }

        clearAuth();
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                connectionError,
                restoreSession,
                login,
                logout,
                clearAuth,
                setUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}