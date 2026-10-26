/**
 * Launchpad / operations dashboard (index.html without ?app=).
 * Built only from standard SAP UI5 controls: ShellBar, GenericTile, Card, microcharts.
 *
 * Flow:  who is signed in (shared/session.js) -> load data the role may read -> calculate figures
 *        -> build the page: header, Key Figures, My Apps, Insights.
 * Every section only appears if the user's role can read its data (the backend refuses the rest).
 */
sap.ui.define([
    "sap/f/ShellBar", "sap/f/GridContainer", "sap/f/GridContainerSettings", "sap/f/GridContainerItemLayoutData",
    "sap/f/Card", "sap/f/cards/Header",
    "sap/m/Page", "sap/m/VBox", "sap/m/HBox", "sap/m/FlexBox", "sap/m/Title", "sap/m/Text", "sap/m/Label",
    "sap/m/Avatar", "sap/m/Button", "sap/m/ObjectStatus", "sap/m/GenericTile", "sap/m/TileContent",
    "sap/m/NumericContent", "sap/m/ImageContent", "sap/m/List", "sap/m/StandardListItem",
    "sap/m/ResponsivePopover", "sap/m/IllustratedMessage", "sap/m/MessageStrip", "sap/m/OverflowToolbarButton",
    "sap/m/ProgressIndicator", "sap/ui/core/Icon",
    "sap/suite/ui/microchart/StackedBarMicroChart", "sap/suite/ui/microchart/StackedBarMicroChartBar"
], function (
    ShellBar, GridContainer, GridContainerSettings, GridContainerItemLayoutData, Card, CardHeader,
    Page, VBox, HBox, FlexBox, Title, Text, Label, Avatar, Button, ObjectStatus, GenericTile, TileContent,
    NumericContent, ImageContent, List, StandardListItem, ResponsivePopover, IllustratedMessage, MessageStrip,
    OverflowToolbarButton, ProgressIndicator, Icon, StackedBarMicroChart, StackedBarMicroChartBar
) {
    "use strict";

    const { apps: APPS, roles: ROLES, allows } = window.RETCL;               // shared/config.js

    // Quick actions in the header: what each role usually does first
    const QUICK = {
        "rentals": { text: "Manage rentals", icon: "sap-icon://sales-document" },
        "inspections": { text: "Log inspection", icon: "sap-icon://inspection" },
        "damage-charge-approval": { text: "Review charges", icon: "sap-icon://money-bills" },
        "repair-jobs": { text: "Workshop queue", icon: "sap-icon://wrench" },
        "maintenance-planner": { text: "Plan service", icon: "sap-icon://appointment-2" },
        "fleet-overview": { text: "Find an asset", icon: "sap-icon://search" },
        "customer-management": { text: "Customers", icon: "sap-icon://customer" }
    };
    const QUICK_ORDER = {
        Dispatcher: ["rentals", "fleet-overview", "customer-management"],
        YardWorker: ["inspections", "fleet-overview"],
        Technician: ["repair-jobs", "maintenance-planner", "fleet-overview"],
        BillingClerk: ["damage-charge-approval", "rentals", "customer-management"],
        Manager: ["damage-charge-approval", "rentals", "repair-jobs"],
        Admin: ["rentals", "damage-charge-approval", "fleet-overview"],
        Auditor: ["fleet-overview", "damage-charge-approval", "rentals"]
    };

    // Equipment status: label and semantic colour (Good = green, Critical = orange, Error = red)
    const STATUS = {
        Available: ["Available", "Good"], RentedOut: ["Rented out", "Neutral"], InTransit: ["In transit", "Neutral"],
        ReturnedPendingInspection: ["Awaiting inspection", "Critical"], UnderMaintenance: ["Under maintenance", "Critical"],
        InRepair: ["In repair", "Critical"], Damaged: ["Damaged", "Error"], Quarantined: ["Quarantined", "Error"], Retired: ["Retired", "Neutral"]
    };
    const statusText = s => STATUS[s]?.[0] || s;
    const statusColor = s => STATUS[s]?.[1] || "Neutral";
    const STATE_OF = { Good: "Success", Error: "Error", Critical: "Warning", Neutral: "None" };  // colour -> list item state
    const OPEN_BILLS = ["Draft", "PendingApproval", "Adjusted", "Disputed", "Approved", "Failed"];  // not yet invoiced
    const BILLS_TO_DECIDE = ["Draft", "PendingApproval", "Adjusted", "Disputed"];               // need a clerk's decision

    // ---------------------------------------------------------------- small helpers
    const today = new Date(new Date().toDateString());
    const daysBetween = (a, b) => Math.round((b - a) / 86400000);
    const go = (app, hash) => { window.location.href = "/index.html?app=" + app + (hash ? "#/" + hash : ""); }; // open an app (or a record)
    const recordKey = (entitySet, id) => entitySet + "(ID=" + id + ",IsActiveEntity=true)";
    const inr = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

    /** Reads an OData list; returns null if the role may not read it (403) or the call fails. */
    async function getList(url) {
        try {
            const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
            return res.ok ? (await res.json()).value : null;
        } catch (e) {
            return null;
        }
    }

    /** Big numbers for tiles: 35400 -> { value: "35.4", scale: "K" } (Indian lakh/crore units). */
    function scaled(amount) {
        const n = Number(amount) || 0;
        if (n >= 1e7) return { value: (n / 1e7).toFixed(1), scale: "Cr" };
        if (n >= 1e5) return { value: (n / 1e5).toFixed(1), scale: "L" };
        if (n >= 1e3) return { value: (n / 1e3).toFixed(1), scale: "K" };
        return { value: String(n), scale: "" };
    }

    /** "5 min ago", "3 h ago", "2 d ago" */
    function timeAgo(iso) {
        const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (mins < 60) return mins < 1 ? "just now" : mins + " min ago";
        const hours = Math.round(mins / 60);
        return hours < 24 ? hours + " h ago" : Math.round(hours / 24) + " d ago";
    }

    const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

    // ---------------------------------------------------------------- layout helpers
    function sectionTitle(text, icon, hint) {
        return new HBox({ alignItems: "Center", items: [
            new Icon({ src: icon, size: "1.125rem" }).addStyleClass("retclSectionIcon"),
            new Title({ text, level: "H3", titleStyle: "H5" }),
            new Text({ text: hint }).addStyleClass("retclSectionHint")
        ] }).addStyleClass("retclSection");
    }
    const grid = items => new GridContainer({ layout: new GridContainerSettings({ rowSize: "5rem", columnSize: "5rem", gap: "1rem" }), snapToRow: true, items });
    const cell = (columns, rows) => new GridContainerItemLayoutData({ columns, minRows: rows });  // size of a tile/card in the grid

    /** Removes the "Loading..." placeholder and returns the element the page is placed in. */
    function mountPoint() {
        const root = document.getElementById("launchpad-root");
        root.querySelector(".retclBoot")?.remove();
        return root;
    }

    // ---------------------------------------------------------------- 1. data
    const EQUIPMENT_URL = "/rental/Equipment?$filter=IsActiveEntity eq true&$select=ID,equipmentNo,equipmentName,currentStatus,currentGrade,nextServiceDate";

    /** Loads everything in parallel; a list the role may not read comes back as null. */
    async function loadData(canOpen) {
        const [equipment, rentals, bills, history] = await Promise.all([
            // depot names need Locations access: retry without them for roles that cannot read Locations
            getList(EQUIPMENT_URL + "&$expand=location($select=locationName)").then(list => list || getList(EQUIPMENT_URL)),
            getList("/rental/Rentals?$filter=IsActiveEntity eq true&$select=ID,contractNo,rentalStatus,expectedReturnDate&$expand=customer($select=companyName)"),
            canOpen("damage-charge-approval")
                ? getList("/billing/RepairBills?$filter=IsActiveEntity eq true&$select=ID,invoiceNo,billingStatus,totalAmount&$expand=customer($select=companyName)")
                : null,
            getList("/rental/AssetStatusHistory?$orderby=changedAt desc&$top=6&$select=ID,oldStatus,newStatus,changedAt,reason&$expand=equipment($select=ID,equipmentNo,equipmentName)")
        ]);
        return { equipment, rentals, bills, history };
    }

    // ---------------------------------------------------------------- 2. figures
    /** Counts and lists the dashboard needs. Only sets what the loaded data allows. */
    function calculateFigures({ equipment, rentals, bills }) {
        const f = {};
        if (equipment) {
            f.total = equipment.length;
            f.byStatus = {}; f.byGrade = { A: 0, B: 0, C: 0, D: 0 }; f.byDepot = {};
            for (const e of equipment) {
                f.byStatus[e.currentStatus] = (f.byStatus[e.currentStatus] || 0) + 1;
                if (e.currentGrade in f.byGrade) f.byGrade[e.currentGrade]++;
                const depot = e.location?.locationName || "Unassigned";
                f.byDepot[depot] = (f.byDepot[depot] || 0) + 1;
            }
            f.available = f.byStatus.Available || 0;
            f.rentedOut = f.byStatus.RentedOut || 0;
            f.notRentable = equipment.filter(e => ["Damaged", "Quarantined", "InRepair", "ReturnedPendingInspection"].includes(e.currentStatus));
            f.serviceDue = equipment.filter(e => e.nextServiceDate && daysBetween(today, new Date(e.nextServiceDate)) <= 30)
                .sort((a, b) => new Date(a.nextServiceDate) - new Date(b.nextServiceDate));
        }
        if (rentals) {
            f.activeRentals = rentals.filter(r => r.rentalStatus === "Active" || r.rentalStatus === "Overdue");
            f.overdue = f.activeRentals.filter(r => r.rentalStatus === "Overdue" || new Date(r.expectedReturnDate) < today);
        }
        if (bills) {
            const sum = list => list.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
            f.billsToDecide = bills.filter(b => BILLS_TO_DECIDE.includes(b.billingStatus));
            f.openAmount = sum(bills.filter(b => OPEN_BILLS.includes(b.billingStatus)));
            f.billedAmount = sum(bills.filter(b => b.billingStatus === "Posted" || b.billingStatus === "Billed"));
        }
        return f;
    }

    // ---------------------------------------------------------------- 3a. Key Figures tiles
    function kpiTile({ header, subheader, value, scale, icon, color, footer, app }) {
        const tile = new GenericTile({
            header, subheader, frameType: "OneByOne", layoutData: cell(2, 2),
            tileContent: [new TileContent({ footer, content: new NumericContent({ value, scale, icon, valueColor: color, withMargin: false, nullifyValue: false }) })]
        });
        if (app) tile.attachPress(() => go(app)).setTooltip("Open " + APPS[app].title);  // clickable only if the role can open it
        return tile;
    }

    function keyFigureTiles(f, canOpen) {
        const tiles = [];
        const fleet = canOpen("fleet-overview") ? "fleet-overview" : null;
        if (f.total !== undefined) {
            tiles.push(kpiTile({ header: "Available Fleet", subheader: "Ready for dispatch", value: String(f.available), icon: "sap-icon://accept",
                color: f.available ? "Good" : "Critical", footer: "of " + f.total + " assets", app: fleet }));
            tiles.push(kpiTile({ header: "Rented Out", subheader: "On customer sites", value: String(f.rentedOut), icon: "sap-icon://shipping-status",
                color: "Neutral", footer: f.activeRentals ? f.activeRentals.length + " active contracts" : "assets on rent",
                app: canOpen("rentals") ? "rentals" : fleet }));
        }
        if (f.overdue) {
            tiles.push(kpiTile({ header: "Overdue Returns", subheader: "Past expected return", value: String(f.overdue.length), icon: "sap-icon://lateness",
                color: f.overdue.length ? "Error" : "Good", footer: f.overdue.length ? "follow up with customer" : "all on schedule", app: "rentals" }));
        }
        if (f.notRentable) {
            tiles.push(kpiTile({ header: "Damaged / Quarantined", subheader: "Not rentable", value: String(f.notRentable.length), icon: "sap-icon://alert",
                color: f.notRentable.length ? "Error" : "Good", footer: "awaiting repair or inspection",
                app: canOpen("repair-jobs") ? "repair-jobs" : fleet }));
        }
        if (f.billsToDecide) {
            const { value, scale } = scaled(f.openAmount);
            tiles.push(kpiTile({ header: "Open Damage Charges", subheader: "INR · " + f.billsToDecide.length + " need a decision", value, scale,
                icon: "sap-icon://money-bills", color: f.billsToDecide.length ? "Critical" : "Good",
                footer: inr(f.billedAmount) + " billed", app: "damage-charge-approval" }));
        }
        if (f.serviceDue) {
            tiles.push(kpiTile({ header: "Service Due", subheader: "Within 30 days", value: String(f.serviceDue.length), icon: "sap-icon://appointment-2",
                color: f.serviceDue.length ? "Critical" : "Good", footer: "planned maintenance",
                app: canOpen("maintenance-planner") ? "maintenance-planner" : fleet }));
        }
        return tiles;
    }

    // ---------------------------------------------------------------- 3b. My Apps tiles
    function appFooter(appId, f) {
        return {
            "fleet-overview": f.total !== undefined && f.total + " assets",
            "rentals": f.activeRentals && f.activeRentals.length + " active contracts",
            "damage-charge-approval": f.billsToDecide && f.billsToDecide.length + " to review",
            "repair-jobs": f.notRentable && f.notRentable.length + " assets in workshop",
            "maintenance-planner": f.serviceDue && f.serviceDue.length + " due in 30 days"
        }[appId] || "";
    }
    function appTile(appId, footer) {
        const app = APPS[appId];
        return new GenericTile({
            header: app.title, subheader: app.subtitle, frameType: "OneByOne", press: () => go(appId),
            tileContent: [new TileContent({ footer, content: new ImageContent({ src: app.icon }) })]
        });
    }

    // ---------------------------------------------------------------- 3c. Insight cards
    function fleetCard(f) {
        if (f.total === undefined) return null;
        const statuses = Object.keys(STATUS).filter(s => f.byStatus[s]);
        const gradeColor = { A: "Good", B: "Neutral", C: "Critical", D: "Error" };
        const grades = Object.keys(gradeColor).filter(g => f.byGrade[g]);
        const depots = Object.entries(f.byDepot).sort((a, b) => b[1] - a[1]).slice(0, 4);
        return new Card({
            layoutData: cell(6, 4),
            header: new CardHeader({ title: "Fleet Status", subtitle: f.total + " assets across all depots", iconSrc: "sap-icon://shipping-status" }),
            content: new VBox({ items: [
                new Label({ text: "Operational status" }),
                new StackedBarMicroChart({ size: "Responsive", height: "2rem", width: "100%",
                    bars: statuses.map(s => new StackedBarMicroChartBar({ value: f.byStatus[s], valueColor: statusColor(s), displayValue: String(f.byStatus[s]) })) }),
                new FlexBox({ wrap: "Wrap", items: statuses.map(s => new ObjectStatus({ title: statusText(s), text: String(f.byStatus[s]), state: STATE_OF[statusColor(s)] })
                    .addStyleClass("sapUiSmallMarginEnd sapUiTinyMarginBottom")) }).addStyleClass("sapUiTinyMarginTop"),
                new Label({ text: "Condition grade (A best - D poor)" }).addStyleClass("sapUiSmallMarginTop"),
                new StackedBarMicroChart({ size: "Responsive", height: "2rem", width: "100%",
                    bars: grades.map(g => new StackedBarMicroChartBar({ value: f.byGrade[g], valueColor: gradeColor[g], displayValue: "Grade " + g + ": " + f.byGrade[g] })) }),
                new Label({ text: "Assets by depot" }).addStyleClass("sapUiSmallMarginTop"),
                ...depots.map(([depot, n]) => new VBox({ items: [
                    new Text({ text: depot }).addStyleClass("retclDepotName"),
                    new ProgressIndicator({ percentValue: Math.round(n / f.total * 100), displayValue: n + (n === 1 ? " asset" : " assets"), height: "1.25rem", width: "100%", displayOnly: true })
                ] }))
            ] }).addStyleClass("sapUiSmallMargin")
        });
    }

    /** Things a user should act on: overdue returns, bills to decide, assets not rentable, services due. */
    function attentionItems(f, canOpen) {
        const items = [];
        for (const r of f.overdue || []) items.push({
            title: r.contractNo + " overdue", icon: "sap-icon://lateness", state: "Error",
            description: (r.customer ? r.customer.companyName + " · " : "") + "expected back " + new Date(r.expectedReturnDate).toLocaleDateString("en-IN"),
            info: daysBetween(new Date(r.expectedReturnDate), today) + " days late", app: "rentals", hash: recordKey("Rentals", r.ID)
        });
        for (const b of f.billsToDecide || []) items.push({
            title: "Damage charge " + b.invoiceNo + " - " + inr(b.totalAmount), icon: "sap-icon://money-bills",
            description: (b.customer ? b.customer.companyName + " · " : "") + b.billingStatus.replace(/([A-Z])/g, " $1").trim(),
            info: b.billingStatus === "Disputed" ? "Disputed" : "Needs decision", state: b.billingStatus === "Disputed" ? "Error" : "Warning",
            app: "damage-charge-approval", hash: recordKey("RepairBills", b.ID)
        });
        for (const e of f.notRentable || []) items.push({
            title: e.equipmentNo + " · " + e.equipmentName, icon: "sap-icon://alert",
            description: statusText(e.currentStatus) + (e.currentGrade ? " · condition grade " + e.currentGrade : ""),
            info: statusText(e.currentStatus), state: STATE_OF[statusColor(e.currentStatus)],
            app: canOpen("repair-jobs") ? "repair-jobs" : "fleet-overview", hash: canOpen("repair-jobs") ? null : recordKey("Equipment", e.ID)
        });
        for (const e of (f.serviceDue || []).slice(0, 4)) {
            const days = daysBetween(today, new Date(e.nextServiceDate));
            items.push({
                title: "Service due: " + e.equipmentNo + " · " + e.equipmentName, icon: "sap-icon://appointment-2",
                description: "Next service " + new Date(e.nextServiceDate).toLocaleDateString("en-IN"),
                info: days < 0 ? -days + " days overdue" : "in " + days + " days", state: days < 0 ? "Error" : "Warning",
                app: "fleet-overview", hash: recordKey("Equipment", e.ID)
            });
        }
        return items.filter(i => canOpen(i.app));                              // only items the user can open
    }

    function attentionCard(items) {
        const subtitle = items.length > 6 ? "Top 6 of " + items.length + " open items" : items.length ? items.length + " open items" : "Nothing open";
        return new Card({
            layoutData: cell(6, 4),
            header: new CardHeader({ title: "Needs Your Attention", subtitle, iconSrc: "sap-icon://warning2", statusText: items.length ? String(items.length) : "" }),
            content: new List({
                showSeparators: "Inner", noDataText: "All clear - nothing needs your attention right now.",
                items: items.slice(0, 6).map(i => new StandardListItem({
                    title: i.title, description: i.description, icon: i.icon, info: i.info, infoState: i.state,
                    type: "Navigation", wrapping: true, press: () => go(i.app, i.hash)
                }))
            })
        }).addStyleClass("retclAttention");                                    // target for the notification bell
    }

    function activityCard(history, canOpen) {
        if (!history?.length) return null;                                     // hidden until there is history
        return new Card({
            layoutData: cell(12, 3),
            header: new CardHeader({ title: "Recent Asset Activity", subtitle: "Latest status changes across the fleet", iconSrc: "sap-icon://history" }),
            content: new List({
                showSeparators: "Inner",
                items: history.map(h => new StandardListItem({
                    title: (h.equipment ? h.equipment.equipmentNo + " · " + h.equipment.equipmentName : "Asset") + ": " + statusText(h.oldStatus || "-") + " → " + statusText(h.newStatus),
                    description: h.reason || "", icon: "sap-icon://history", info: timeAgo(h.changedAt),
                    infoState: STATE_OF[statusColor(h.newStatus)], wrapping: true,
                    type: h.equipment && canOpen("fleet-overview") ? "Navigation" : "Inactive",
                    press: () => h.equipment && go("fleet-overview", recordKey("Equipment", h.equipment.ID))
                }))
            })
        });
    }

    // ---------------------------------------------------------------- 3d. header and shell bar
    function header(session, role, canOpen) {
        const firstName = session.name.split(/[\s@]/)[0];
        const quick = (QUICK_ORDER[session.role] || []).filter(canOpen).slice(0, 3);
        const date = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        return new FlexBox({ justifyContent: "SpaceBetween", alignItems: "End", wrap: "Wrap", items: [
            new VBox({ items: [
                new Title({ text: greeting() + ", " + firstName, level: "H1", titleStyle: "H3", wrapping: true }),
                new Text({ text: role.title + "  ·  " + session.plant + "  ·  " + date }).addStyleClass("retclMuted sapUiTinyMarginTop")
            ] }),
            new HBox({ items: quick.map(app => new Button({ text: QUICK[app].text, icon: QUICK[app].icon, type: "Transparent", press: () => go(app) })) })
        ] }).addStyleClass("retclHeader");
    }

    function shellBar(session, role, attentionCount) {
        const userMenu = new ResponsivePopover({
            showHeader: false, placement: "Bottom", contentWidth: "18rem",
            content: new VBox({ items: [
                new HBox({ alignItems: "Center", items: [
                    new Avatar({ initials: session.initials, displaySize: "M", backgroundColor: "Accent6" }).addStyleClass("sapUiSmallMarginEnd"),
                    new VBox({ items: [new Title({ text: session.name, level: "H4" }), new Text({ text: session.email })] })
                ] }),
                new ObjectStatus({ title: "Role", text: session.role === "None" ? "No role assigned" : session.role + " - " + role.title,
                    state: session.role === "None" ? "Error" : "Information" }).addStyleClass("sapUiSmallMarginTop"),
                new ObjectStatus({ title: "Plant", text: session.plant }),
                new Button({ text: "Sign Out", icon: "sap-icon://log", width: "100%", type: "Transparent",
                    press: () => { window.location.href = "/do/logout"; } }).addStyleClass("sapUiSmallMarginTop")   // approuter logout
            ] }).addStyleClass("sapUiSmallMargin")
        });
        return new ShellBar({
            title: "Rental Equipment Tracking",
            secondTitle: "Fleet · Condition · Repair Billing",
            homeIcon: "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32" rx="6" fill="#0070F2"/>' +
                '<text x="32" y="22" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">RET</text></svg>'),
            homeIconPressed: () => { window.location.href = "/index.html"; },
            showNotifications: attentionCount > 0,
            notificationsNumber: attentionCount ? String(attentionCount) : "",
            notificationsPressed: () => document.querySelector(".retclAttention")?.scrollIntoView({ behavior: "smooth", block: "center" }),
            profile: new Avatar({ initials: session.initials, backgroundColor: "Accent6" }),
            avatarPressed: e => userMenu.openBy(e.getParameter("avatar")),
            additionalContent: [new OverflowToolbarButton({ icon: "sap-icon://refresh", text: "Refresh", tooltip: "Refresh figures", press: () => window.location.reload() })]
        });
    }

    // ---------------------------------------------------------------- 4. assemble the page
    async function render(session) {
        const role = ROLES[session.role];
        const canOpen = appId => allows(role.apps, appId);
        const data = await loadData(canOpen);
        const f = calculateFigures(data);
        const attention = attentionItems(f, canOpen);

        const content = new VBox({ width: "100%" }).addStyleClass("retclContainer");
        content.addItem(header(session, role, canOpen));
        if (session.role === "None") {
            content.addItem(new MessageStrip({ type: "Warning", showIcon: true,
                text: "Your SAP user has no role for this application yet. Ask an administrator to assign a sprint role collection, then sign in again." }));
        }

        const kpis = keyFigureTiles(f, canOpen);
        if (kpis.length) content.addItem(sectionTitle("Key Figures", "sap-icon://kpi-managing-my-area", "Live from the system")).addItem(grid(kpis));

        // App tiles grouped by business area (group names come from shared/config.js)
        const groups = [...new Set(Object.values(APPS).map(a => a.group))].map(group => {
            const ids = Object.keys(APPS).filter(id => APPS[id].group === group && canOpen(id));
            return ids.length && new VBox({ items: [
                new Title({ text: group, level: "H4", titleStyle: "H6" }).addStyleClass("sapUiTinyMarginBottom"),
                new HBox({ items: ids.map(id => appTile(id, appFooter(id, f)).addStyleClass("sapUiSmallMarginEnd")) })
            ] }).addStyleClass("sapUiSmallMarginEnd sapUiSmallMarginBottom");
        }).filter(Boolean);
        if (groups.length) content.addItem(sectionTitle("My Apps", "sap-icon://grid", "Grouped by business area")).addItem(new FlexBox({ wrap: "Wrap", alignItems: "Start", items: groups }));

        const cards = [fleetCard(f), session.role !== "None" && attentionCard(attention), activityCard(data.history, canOpen)].filter(Boolean);
        if (cards.length) content.addItem(sectionTitle("Insights", "sap-icon://business-objects-experience", "What needs a decision")).addItem(grid(cards));

        content.addItem(new Text({ text: "Rental Equipment Tracking & Condition Logging · SAP BTP CAP + Fiori · figures as of " +
            new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }).addStyleClass("retclFooter"));

        new Page({ customHeader: shellBar(session, role, attention.length), content: [content] })
            .addStyleClass("sapUiResponsivePadding--header sapUiResponsivePadding--content")
            .placeAt(mountPoint(), "only");
    }

    /** Shown when the page is opened without the SAP approuter (no login). */
    function renderSignedOut() {
        new Page({ showHeader: false, content: [new IllustratedMessage({
            illustrationType: "sapIllus-UnableToLoad", title: "You are not signed in",
            description: "Open this app through its SAP app router URL to sign in with your SAP account.",
            additionalContent: [new Button({ text: "Sign in with SAP", type: "Emphasized", press: () => { window.location.href = "/"; } })]
        })] }).placeAt(mountPoint(), "only");
    }

    // ---------------------------------------------------------------- start
    window.loadSession().then(session => {
        if (!session) return renderSignedOut();
        render(session).catch(err => {
            console.error("Launchpad failed to render", err);
            new Page({ showHeader: false, content: [new MessageStrip({ type: "Error", showIcon: true, text: "The launchpad could not be loaded: " + err.message })] })
                .placeAt(mountPoint(), "only");
        });
    });
});
