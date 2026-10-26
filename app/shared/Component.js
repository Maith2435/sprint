/**
 * Shared UI5 component for all 8 Fiori Elements apps.
 * Each app folder only has a manifest.json (pages, tables, data source); the server sends this
 * file for every /<app>/webapp/Component.js request. It creates a standard Fiori Elements
 * AppComponent named after the app shown (index.html?app=<id>), which then reads that app's manifest.
 */
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
    "use strict";
    const appId = new URLSearchParams(window.location.search).get("app");   // e.g. "rentals"
    const app = window.RETCL.apps[appId];                                     // from shared/config.js
    return AppComponent.extend(app.ns + ".Component", {                       // e.g. retcl.rentals.Component
        metadata: { manifest: "json" }                                        // load webapp/manifest.json
    });
});
