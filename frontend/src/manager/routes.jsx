import { Route } from "react-router-dom";

import ManagerPage from "./ManagerPage.jsx";

import InvoicePrintPage from
    "../receptionist/InvoicePrintPage.jsx";

import { menu } from "./config.js";

export function managerRoutes() {
    const standardPages = menu.filter(
        ([path]) =>
            ![
                "dashboard",
                "reservation-approvals"
            ].includes(path)
    );

    return [
        ...standardPages.map(([path]) => (
            <Route
                key={`manager-${path}`}
                path={path}
                element={
                    <ManagerPage
                        key={path}
                        resource={path}
                    />
                }
            />
        )),

        <Route
            key="manager-invoice-print"
            path="invoices/:invoiceId/print"
            element={
                <InvoicePrintPage
                    workspace="manager"
                />
            }
        />
    ];
}