import { useState } from "react";
import ReceptionistPage from "../receptionist/ReceptionistPage.jsx";
import ManagerOperationsPage from "./ManagerOperationsPage.jsx";
import ManagerReports from "./ManagerReports.jsx";

function ServicesPage() {
    const [tab, setTab] = useState("requests");
    return <><div className="mg-tabs" role="group" aria-label="Guest service views"><button type="button" className={`rx-button ${tab === "requests" ? "" : "rx-secondary"}`} aria-pressed={tab === "requests"} onClick={() => setTab("requests")}>Guest requests</button><button type="button" className={`rx-button ${tab === "catalog" ? "" : "rx-secondary"}`} aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}>Service catalogue & prices</button></div>
        {tab === "requests" ? <ReceptionistPage key="requests" resource="service-requests" workspace="manager" /> : <ManagerOperationsPage key="catalog" resource="services" />}
    </>;
}
export default function ManagerPage({ resource }) {
    if (resource === "dashboard") return <ManagerReports overview />;
    if (resource === "reports") return <ManagerReports />;
    if (resource === "services") return <ServicesPage />;
    if (["hotel", "room-types", "rooms", "housekeeping", "maintenance"].includes(resource)) return <ManagerOperationsPage resource={resource} />;
    return <ReceptionistPage resource={resource} workspace="manager" />;
}
