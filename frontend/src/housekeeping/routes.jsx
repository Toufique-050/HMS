import { Route } from "react-router-dom";
import HousekeepingPage from "./HousekeepingPage.jsx";
import { menu } from "./config.js";
export function housekeepingRoutes() { return menu.filter(([path]) => path !== "dashboard").map(([path]) => <Route key={`hk-${path}`} path={path} element={<HousekeepingPage key={path} resource={path} />} />); }
