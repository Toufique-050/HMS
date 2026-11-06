import { Outlet } from "react-router-dom";
import Navbar from "../components/navigation/Navbar.jsx";
import Footer from "../components/navigation/Footer.jsx";

const PublicLayout = () => {
    return (
        <>
            <Navbar />

            <main>
                <Outlet />
            </main>

            <Footer />
        </>
    );
};

export default PublicLayout;