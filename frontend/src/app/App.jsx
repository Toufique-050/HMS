import { BrowserRouter } from "react-router-dom";
import AuthProvider from "../context/AuthContext.jsx";
import AppRoutes from "./router.jsx";

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}