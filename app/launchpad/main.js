/**
 * Rental Equipment Tracking - Fiori launchpad / operations dashboard.
 * Built from standard SAP UI5 controls (ShellBar, GenericTile, Card, microcharts).
 * The signed-in SAP (XSUAA) user and roles come from fiori-auth.js; every card only
 * shows data the user's role is allowed to read.
 */
sap.ui.define([
    "sap/f/ShellBar",
    "sap/f/GridContainer",
    "sap/f/GridContainerSettings",
    "sap/f/GridContainerItemLayoutData",
    "sap/f/Card",
    "sap/f/cards/Header",
    "sap/m/Page",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/FlexBox",
    "sap/m/Title",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Avatar",
    "sap/m/Button",
    "sap/m/ObjectStatus",
    "sap/m/GenericTile",
    "sap/m/TileContent",
    "sap/m/NumericContent",
    "sap/m/ImageContent",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/ResponsivePopover",
    "sap/m/IllustratedMessage",
    "sap/m/MessageStrip",
    "sap/m/OverflowToolbarButton",
    "sap/suite/ui/microchart/StackedBarMicroChart",
    "sap/suite/ui/microchart/StackedBarMicroChartBar",
    "sap/m/ProgressIndicator",
    "sap/ui/core/Icon"
], function (
    ShellBar, GridContainer, GridContainerSettings, GridContainerItemLayoutData, Card, CardHeader,
    Page, VBox, HBox, FlexBox, Title, Text, Label, Avatar, Button, ObjectStatus,
    GenericTile, TileContent, NumericContent, ImageContent, List, StandardListItem,
    ResponsivePopover, IllustratedMessage, MessageStrip, OverflowToolbarButton,
    StackedBarMicroChart, StackedBarMicroChartBar, ProgressIndicator, Icon
) {
    "use strict";

    // ---------------------------------------------------------------- app catalogue
    const APPS = {
        "customer-management":    { title: "Customer Management", subtitle: "Customers & contacts", icon: "sap-icon://customer" },
        "rentals":                { title: "Rental Contracts", subtitle: "Check-out & check-in", icon: "sap-icon://sales-document" },
        "locations":              { title: "Depots & Yards", subtitle: "Locations & assets", icon: "sap-icon://map-2" },
        "fleet-overview":         { title: "Fleet Overview", subtitle: "Status & condition", icon: "sap-icon://shipping-status" },
        "inspections":            { title: "Inspections", subtitle: "Condition logs", icon: "sap-icon://inspection" },
        "damage-charge-approval": { title: "Damage Charge Approval", subtitle: "Approve & dispute", icon: "sap-icon://money-bills" },
        "repair-jobs":            { title: "Workshop Repair Jobs", subtitle: "Repairs & release", icon: "sap-icon://wrench" },
        "maintenance-planner":    { title: "Maintenance Planner", subtitle: "Due services", icon: "sap-icon://appointment-2" }
    };
    const GROUPS = [
        { title: "Rental Operations", apps: ["rentals", "customer-management", "locations"] },
        { title: "Fleet & Yard", apps: ["fleet-overview", "inspections"] },
        { title: "Billing", apps: ["damage-charge-approval"] },
        { title: "Workshop & Maintenance", apps: ["repair-jobs", "maintenance-planner"] }
    ];
    // Hero quick actions: what each role usually does first
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
    const STATUS_TEXT = {
        Available: "Available", RentedOut: "Rented out", ReturnedPendingInspection: "Awaiting inspection",
        Damaged: "Damaged", InRepair: "In repair", InTransit: "In transit", UnderMaintenance: "Under maintenance",
        Quarantined: "Quarantined", Retired: "Retired"
    };
    const STATUS_COLOR = {
        Available: "Good", RentedOut: "Neutral", InTransit: "Neutral", ReturnedPendingInspection: "Critical",
        InRepair: "Critical", UnderMaintenance: "Critical", Damaged: "Error", Quarantined: "Error", Retired: "Neutral"
    };
    const STATE_OF = { Good: "Success", Error: "Error", Critical: "Warning", Neutral: "None" };
    const OPEN_BILL_STATES = ["Draft", "PendingApproval", "Adjusted", "Disputed", "Approved", "Failed"];
    const BILL_ACTION_STATES = ["Draft", "PendingApproval", "Adjusted", "Disputed"];

    // ---------------------------------------------------------------- helpers
    const today = new Date(new Date().toDateString());
    const daysBetween = (a, b) => Math.round((b - a) / 86400000);
    const appUrl = (app, hash) => "/index.html?app=" + app + (hash ? "#/" + hash : "");
    const go = (app, hash) => { window.location.href = appUrl(app, hash); };
    const key = (set, id) => set + "(ID=" + id + ",IsActiveEntity=true)";

    async function getJson(url) {
        try {
            const res = await fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" });
            if (!res.ok) return null;
            return (await res.json()).value || [];
        } catch (e) {
            return null;
        }
    }

    function inr(amount) {
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
    }
    // NumericContent shows value + scale, e.g. 35.4 K
    function scaled(amount) {
        const n = Number(amount) || 0;
        if (n >= 1e7) return { value: (n / 1e7).toFixed(1), scale: "Cr" };
        if (n >= 1e5) return { value: (n / 1e5).toFixed(1), scale: "L" };
        if (n >= 1e3) return { value: (n / 1e3).toFixed(1), scale: "K" };
        return { value: String(n), scale: "" };
    }
    function relative(iso) {
        if (!iso) return "";
        const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + " min ago";
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return hrs + " h ago";
        const days = Math.round(hrs / 24);
        return days < 30 ? days + " d ago" : new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }
    function greeting() {
        const h = new Date().getHours();
        return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    }
    function sectionTitle(text, icon, hint) {
        return new HBox({ alignItems: "Center", items: [
            new Icon({ src: icon || "sap-icon://along-stacked-chart", size: "1.125rem" }).addStyleClass("retclSectionIcon"),
            new Title({ text: text, level: "H3", titleStyle: "H5" }),
            hint ? new Text({ text: hint }).addStyleClass("retclSectionHint") : null
        ].filter(Boolean) }).addStyleClass("retclSection");
    }
    function grid(items) {
        return new GridContainer({
            layout: new GridContainerSettings({ rowSize: "5rem", columnSize: "5rem", gap: "1rem" }),
            snapToRow: true,
            items: items
        });
    }
    function cardLayout(columns, rows) {
        return new GridContainerItemLayoutData({ columns: columns, minRows: rows });
    }

    // Clears the static "Loading" placeholder so the UI5 page gets the full height
    function mountPoint() {
        const root = document.getElementById("launchpad-root");
        const boot = root.querySelector(".retclBoot");
        if (boot) boot.remove();
        return root;
    }

    // ---------------------------------------------------------------- not signed in
    function renderSignedOut() {
        new Page({
            showHeader: false,
            content: [
                new IllustratedMessage({
                    illustrationType: "sapIllus-UnableToLoad",
                    title: "You are not signed in",
                    description: "Open this app through its SAP app router URL to sign in with your SAP account.",
                    additionalContent: [
                        new Button({ text: "Sign in with SAP", type: "Emphasized", press: () => { window.location.href = "/"; } })
                    ]
                })
            ]
        }).placeAt(mountPoint(), "only");
    }

    // ---------------------------------------------------------------- data
    const EQUIPMENT_URL = "/rental/Equipment?$filter=IsActiveEntity eq true&$select=ID,equipmentNo,equipmentName,currentStatus,currentGrade,nextServiceDate";
    async function loadData(canOpen) {
        const [equipment, rentals, bills, history] = await Promise.all([
            // Depot names need Locations access; retry without them for roles that cannot read Locations
            getJson(EQUIPMENT_URL + "&$expand=location($select=locationName)").then(r => r || getJson(EQUIPMENT_URL)),
            getJson("/rental/Rentals?$filter=IsActiveEntity eq true&$select=ID,contractNo,rentalStatus,expectedReturnDate,totalRentalAmount&$expand=customer($select=companyName)"),
            canOpen("damage-charge-approval")
                ? getJson("/billing/RepairBills?$filter=IsActiveEntity eq true&$select=ID,invoiceNo,billingStatus,totalAmount,billDate&$expand=customer($select=companyName)")
                : Promise.resolve(null),
            getJson("/rental/AssetStatusHistory?$orderby=changedAt desc&$top=6&$select=ID,oldStatus,newStatus,changedAt,changedBy,reason&$expand=equipment($select=ID,equipmentNo,equipmentName)")
        ]);
        return { equipment, rentals, bills, history };
    }

    function analyse(d) {
        const a = {};
        if (d.equipment) {
            a.total = d.equipment.length;
            a.byStatus = {};
            a.byGrade = { A: 0, B: 0, C: 0, D: 0 };
            d.equipment.forEach(e => {
                a.byStatus[e.currentStatus] = (a.byStatus[e.currentStatus] || 0) + 1;
                if (a.byGrade[e.currentGrade] !== undefined) a.byGrade[e.currentGrade]++;
            });
            a.byDepot = {};
            d.equipment.forEach(e => {
                const depot = e.location ? e.location.locationName : "Unassigned";
                a.byDepot[depot] = (a.byDepot[depot] || 0) + 1;
            });
            a.available = a.byStatus.Available || 0;
            a.rentedOut = a.byStatus.RentedOut || 0;
            a.attentionAssets = d.equipment.filter(e => ["Damaged", "Quarantined", "InRepair", "ReturnedPendingInspection"].includes(e.currentStatus));
            a.serviceDue = d.equipment.filter(e => e.nextServiceDate && daysBetween(today, new Date(e.nextServiceDate)) <= 30)
                .sort((x, y) => new Date(x.nextServiceDate) - new Date(y.nextServiceDate));
        }
        if (d.rentals) {
            a.activeRentals = d.rentals.filter(r => r.rentalStatus === "Active" || r.rentalStatus === "Overdue");
            a.overdue = a.activeRentals.filter(r => r.rentalStatus === "Overdue" || (r.expectedReturnDate && new Date(r.expectedReturnDate) < today));
        }
        if (d.bills) {
            a.openBills = d.bills.filter(b => OPEN_BILL_STATES.includes(b.billingStatus));
            a.actionBills = d.bills.filter(b => BILL_ACTION_STATES.includes(b.billingStatus));
            a.openAmount = a.openBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
            a.billedAmount = d.bills.filter(b => ["Posted", "Billed"].includes(b.billingStatus)).reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
        }
        return a;
    }

    // ---------------------------------------------------------------- KPI tiles
    function kpiTile(o) {
        const tile = new GenericTile({
            header: o.header,
            subheader: o.subheader,
            frameType: "OneByOne",
            layoutData: cardLayout(2, 2),
            tileContent: [new TileContent({
                unit: o.unit,
                footer: o.footer,
                content: new NumericContent({
                    value: o.value,
                    scale: o.scale,
                    valueColor: o.color || "Neutral",
                    icon: o.icon,
                    withMargin: false,
                    nullifyValue: false
                })
            })]
        });
        // Only clickable when the role can open the related app (UI5 rejects an undefined press handler)
        if (o.app) {
            tile.attachPress(() => go(o.app));
            tile.setTooltip("Open " + APPS[o.app].title);
        }
        return tile;
    }

    function buildKpis(a, canOpen) {
        const tiles = [];
        const fleetApp = canOpen("fleet-overview") ? "fleet-overview" : null;
        if (a.total !== undefined) {
            tiles.push(kpiTile({ header: "Available Fleet", subheader: "Ready for dispatch", value: String(a.available), icon: "sap-icon://accept",
                color: a.available > 0 ? "Good" : "Critical", footer: "of " + a.total + " assets", app: fleetApp }));
            tiles.push(kpiTile({ header: "Rented Out", subheader: "On customer sites", value: String(a.rentedOut), icon: "sap-icon://shipping-status",
                color: "Neutral", footer: a.activeRentals ? a.activeRentals.length + " active contracts" : "assets on rent",
                app: canOpen("rentals") ? "rentals" : fleetApp }));
        }
        if (a.overdue) {
            tiles.push(kpiTile({ header: "Overdue Returns", subheader: "Past expected return", value: String(a.overdue.length), icon: "sap-icon://lateness",
                color: a.overdue.length ? "Error" : "Good", footer: a.overdue.length ? "follow up with customer" : "all on schedule", app: "rentals" }));
        }
        if (a.attentionAssets) {
            tiles.push(kpiTile({ header: "Damaged / Quarantined", subheader: "Not rentable", value: String(a.attentionAssets.length), icon: "sap-icon://alert",
                color: a.attentionAssets.length ? "Error" : "Good", footer: "awaiting repair or inspection",
                app: canOpen("repair-jobs") ? "repair-jobs" : fleetApp }));
        }
        if (a.openBills) {
            const s = scaled(a.openAmount);
            tiles.push(kpiTile({ header: "Open Damage Charges", subheader: "INR · " + a.actionBills.length + " need a decision", value: s.value, scale: s.scale,
                icon: "sap-icon://money-bills", color: a.actionBills.length ? "Critical" : "Good",
                footer: inr(a.billedAmount) + " billed", app: "damage-charge-approval" }));
        }
        if (a.serviceDue) {
            tiles.push(kpiTile({ header: "Service Due", subheader: "Within 30 days", value: String(a.serviceDue.length), icon: "sap-icon://appointment-2",
                color: a.serviceDue.length ? "Critical" : "Good", footer: "planned maintenance",
                app: canOpen("maintenance-planner") ? "maintenance-planner" : fleetApp }));
        }
        return tiles;
    }

    // ---------------------------------------------------------------- insight cards
    function fleetCard(a) {
        if (a.total === undefined) return null;
        const order = ["Available", "RentedOut", "InTransit", "ReturnedPendingInspection", "UnderMaintenance", "InRepair", "Damaged", "Quarantined", "Retired"];
        const present = order.filter(s => a.byStatus[s]);
        const legend = new FlexBox({ wrap: "Wrap", items: present.map(s => new ObjectStatus({
            title: STATUS_TEXT[s], text: String(a.byStatus[s]), state: STATE_OF[STATUS_COLOR[s]]
        }).addStyleClass("sapUiSmallMarginEnd sapUiTinyMarginBottom")) });
        const gradeColors = { A: "Good", B: "Neutral", C: "Critical", D: "Error" };
        const grades = ["A", "B", "C", "D"].filter(g => a.byGrade[g]);
        return new Card({
            layoutData: cardLayout(6, 4),
            header: new CardHeader({ title: "Fleet Status", subtitle: a.total + " assets across all depots", iconSrc: "sap-icon://shipping-status" }),
            content: new VBox({
                items: [
                    new Label({ text: "Operational status" }),
                    new StackedBarMicroChart({ size: "Responsive", height: "2rem", width: "100%",
                        bars: present.map(s => new StackedBarMicroChartBar({ value: a.byStatus[s], valueColor: STATUS_COLOR[s], displayValue: String(a.byStatus[s]) })) }),
                    legend.addStyleClass("sapUiTinyMarginTop"),
                    new Label({ text: "Condition grade (A best - D poor)" }).addStyleClass("sapUiSmallMarginTop"),
                    new StackedBarMicroChart({ size: "Responsive", height: "2rem", width: "100%",
                        bars: grades.map(g => new StackedBarMicroChartBar({ value: a.byGrade[g], valueColor: gradeColors[g], displayValue: "Grade " + g + ": " + a.byGrade[g] })) }),
                    new Label({ text: "Assets by depot" }).addStyleClass("sapUiSmallMarginTop"),
                    ...Object.entries(a.byDepot).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([depot, n]) => new VBox({ items: [
                        new Text({ text: depot }).addStyleClass("retclDepotName"),
                        new ProgressIndicator({ percentValue: Math.round(n / a.total * 100), displayValue: n + (n === 1 ? " asset" : " assets"),
                            state: "None", height: "1.25rem", width: "100%", displayOnly: true })
                    ] }))
                ]
            }).addStyleClass("sapUiSmallMargin")
        });
    }

    function attentionItems(d, a, canOpen) {
        const items = [];
        (a.overdue || []).forEach(r => items.push({
            title: (r.contractNo || "Rental") + " overdue",
            description: (r.customer ? r.customer.companyName + " · " : "") + "expected back " + new Date(r.expectedReturnDate).toLocaleDateString("en-IN"),
            icon: "sap-icon://lateness", info: daysBetween(new Date(r.expectedReturnDate), today) + " days late", state: "Error",
            app: "rentals", hash: key("Rentals", r.ID)
        }));
        (a.actionBills || []).forEach(b => items.push({
            title: "Damage charge " + (b.invoiceNo || "draft") + " - " + inr(b.totalAmount),
            description: (b.customer ? b.customer.companyName + " · " : "") + b.billingStatus.replace(/([A-Z])/g, " $1").trim(),
            icon: "sap-icon://money-bills", info: b.billingStatus === "Disputed" ? "Disputed" : "Needs decision",
            state: b.billingStatus === "Disputed" ? "Error" : "Warning",
            app: "damage-charge-approval", hash: key("RepairBills", b.ID)
        }));
        (a.attentionAssets || []).forEach(e => items.push({
            title: e.equipmentNo + " · " + e.equipmentName,
            description: STATUS_TEXT[e.currentStatus] + (e.currentGrade ? " · condition grade " + e.currentGrade : ""),
            icon: "sap-icon://alert", info: STATUS_TEXT[e.currentStatus], state: STATE_OF[STATUS_COLOR[e.currentStatus]],
            app: canOpen("repair-jobs") ? "repair-jobs" : "fleet-overview",
            hash: canOpen("repair-jobs") ? null : key("Equipment", e.ID)
        }));
        (a.serviceDue || []).slice(0, 4).forEach(e => {
            const days = daysBetween(today, new Date(e.nextServiceDate));
            items.push({
                title: "Service due: " + e.equipmentNo + " · " + e.equipmentName,
                description: "Next service " + new Date(e.nextServiceDate).toLocaleDateString("en-IN"),
                icon: "sap-icon://appointment-2", info: days < 0 ? Math.abs(days) + " days overdue" : "in " + days + " days",
                state: days < 0 ? "Error" : "Warning",
                app: "fleet-overview", hash: key("Equipment", e.ID)
            });
        });
        return items.filter(i => canOpen(i.app));
    }

    function attentionCard(items) {
        return new Card({
            layoutData: cardLayout(6, 4),
            header: new CardHeader({ title: "Needs Your Attention", subtitle: items.length > 6 ? "Top 6 of " + items.length + " open items" : items.length ? items.length + " open items" : "Nothing open",
                iconSrc: "sap-icon://warning2", statusText: items.length ? String(items.length) : "" }),
            content: new List({
                showSeparators: "Inner",
                noDataText: "All clear - nothing needs your attention right now.",
                items: items.slice(0, 6).map(i => new StandardListItem({
                    title: i.title, description: i.description, icon: i.icon, info: i.info, infoState: i.state,
                    type: "Navigation", wrapping: true, press: () => go(i.app, i.hash)
                }))
            })
        });
    }

    function activityCard(history, canOpen) {
        if (!history || !history.length) return null;
        return new Card({
            layoutData: cardLayout(12, 3),
            header: new CardHeader({ title: "Recent Asset Activity", subtitle: "Latest status changes across the fleet", iconSrc: "sap-icon://history" }),
            content: new List({
                showSeparators: "Inner",
                noDataText: "No recent activity.",
                items: history.map(h => new StandardListItem({
                    title: (h.equipment ? h.equipment.equipmentNo + " · " + h.equipment.equipmentName : "Asset") + ": " +
                        (STATUS_TEXT[h.oldStatus] || h.oldStatus || "-") + " → " + (STATUS_TEXT[h.newStatus] || h.newStatus),
                    description: h.reason || "",
                    icon: "sap-icon://history",
                    info: relative(h.changedAt),
                    infoState: STATE_OF[STATUS_COLOR[h.newStatus]] || "None",
                    wrapping: true,
                    type: h.equipment && canOpen("fleet-overview") ? "Navigation" : "Inactive",
                    press: () => h.equipment && go("fleet-overview", key("Equipment", h.equipment.ID))
                }))
            })
        });
    }

    // ---------------------------------------------------------------- app tiles
    function appFooter(app, d, a) {
        switch (app) {
            case "fleet-overview": return a.total !== undefined ? a.total + " assets" : "";
            case "rentals": return a.activeRentals ? a.activeRentals.length + " active contracts" : "";
            case "damage-charge-approval": return a.actionBills ? a.actionBills.length + " to review" : "";
            case "repair-jobs": return a.attentionAssets ? a.attentionAssets.length + " assets in workshop" : "";
            case "maintenance-planner": return a.serviceDue ? a.serviceDue.length + " due in 30 days" : "";
            default: return "";
        }
    }
    function appTile(app, footer) {
        const cfg = APPS[app];
        return new GenericTile({
            header: cfg.title,
            subheader: cfg.subtitle,
            frameType: "OneByOne",
            press: () => go(app),
            tileContent: [new TileContent({ footer: footer, content: new ImageContent({ src: cfg.icon }) })]
        });
    }

    // ---------------------------------------------------------------- shell
    function userPopover(session, roleCfg) {
        const pop = new ResponsivePopover({
            showHeader: false,
            placement: "Bottom",
            contentWidth: "18rem",
            content: new VBox({
                items: [
                    new HBox({ alignItems: "Center", items: [
                        new Avatar({ initials: session.avatar, displaySize: "M", backgroundColor: "Accent6" }).addStyleClass("sapUiSmallMarginEnd"),
                        new VBox({ items: [
                            new Title({ text: session.name, level: "H4" }),
                            new Text({ text: session.username || "" })
                        ] })
                    ] }),
                    new ObjectStatus({ title: "Role", text: session.role === "None" ? "No role assigned" : session.role + " - " + roleCfg.title,
                        state: session.role === "None" ? "Error" : "Information" }).addStyleClass("sapUiSmallMarginTop"),
                    new ObjectStatus({ title: "Plant", text: session.plant }),
                    new Button({ text: "Sign Out", icon: "sap-icon://log", width: "100%", type: "Transparent",
                        press: () => { clearFioriSession(); window.location.href = "/do/logout"; } }).addStyleClass("sapUiSmallMarginTop")
                ]
            }).addStyleClass("sapUiSmallMargin")
        });
        return pop;
    }

    // ---------------------------------------------------------------- page
    async function render(session) {
        const roleCfg = window.FIORI_ROLES_CONFIG[session.role] || window.FIORI_ROLES_CONFIG.None;
        const canOpen = app => roleCfg.apps.includes(app);
        const data = await loadData(canOpen);
        const a = analyse(data);
        const attention = attentionItems(data, a, canOpen);

        const popover = userPopover(session, roleCfg);
        const content = new VBox({ width: "100%" });

        // Header: greeting and context on the left, the role's main tasks on the right
        const firstName = (session.name || "").split(/[\s@]/)[0];
        const quick = (QUICK_ORDER[session.role] || []).filter(canOpen).slice(0, 3);
        content.addItem(new FlexBox({ justifyContent: "SpaceBetween", alignItems: "End", wrap: "Wrap", items: [
            new VBox({ items: [
                new Title({ text: greeting() + (firstName ? ", " + firstName : ""), level: "H1", titleStyle: "H3", wrapping: true }),
                new Text({ text: (session.role === "None" ? "No role assigned" : roleCfg.title) + "  ·  " + session.plant + "  ·  " +
                    today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }).addStyleClass("retclMuted sapUiTinyMarginTop")
            ] }),
            new HBox({ items: quick.map(app => new Button({ text: QUICK[app].text, icon: QUICK[app].icon, type: "Transparent", press: () => go(app) })) })
        ] }).addStyleClass("retclHeader"));

        if (session.role === "None") {
            content.addItem(new MessageStrip({
                type: "Warning", showIcon: true,
                text: "Your SAP user has no role for this application yet. Ask an administrator to assign a sprint role collection, then sign in again."
            }).addStyleClass("sapUiSmallMarginBottom"));
        }

        // Key figures
        const kpis = buildKpis(a, canOpen);
        if (kpis.length) {
            content.addItem(sectionTitle("Key Figures", "sap-icon://kpi-managing-my-area", "Live from the system"));
            content.addItem(grid(kpis));
        }

        // Apps by business area, groups side by side
        const groupBoxes = GROUPS.map(g => {
            const apps = g.apps.filter(canOpen);
            if (!apps.length) return null;
            return new VBox({ items: [
                new Title({ text: g.title, level: "H4", titleStyle: "H6" }).addStyleClass("sapUiTinyMarginBottom"),
                new HBox({ items: apps.map(app => appTile(app, appFooter(app, data, a)).addStyleClass("sapUiSmallMarginEnd")) })
            ] }).addStyleClass("sapUiSmallMarginEnd sapUiSmallMarginBottom");
        }).filter(Boolean);
        if (groupBoxes.length) {
            content.addItem(sectionTitle("My Apps", "sap-icon://grid", "Grouped by business area"));
            content.addItem(new FlexBox({ wrap: "Wrap", alignItems: "Start", items: groupBoxes }));
        }

        // Insights
        const cards = [fleetCard(a), (attention.length || roleCfg.apps.length) ? attentionCard(attention) : null, activityCard(data.history, canOpen)].filter(Boolean);
        if (cards.length) {
            content.addItem(sectionTitle("Insights", "sap-icon://business-objects-experience", "What needs a decision"));
            content.addItem(grid(cards));
        }

        const shell = new ShellBar({
            title: "Rental Equipment Tracking",
            secondTitle: "Fleet · Condition · Repair Billing",
            homeIcon: "data:image/svg+xml;utf8," + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"><rect width="64" height="32" rx="6" fill="#0070F2"/>' +
                '<text x="32" y="22" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">RET</text></svg>'),
            homeIconPressed: () => { window.location.href = "/index.html"; },
            showNotifications: attention.length > 0,
            notificationsNumber: attention.length ? String(attention.length) : "",
            notificationsPressed: () => { const el = document.querySelector(".retclAttention"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); },
            profile: new Avatar({ initials: session.avatar, backgroundColor: "Accent6" }),
            avatarPressed: e => popover.openBy(e.getParameter("avatar")),
            additionalContent: [
                new OverflowToolbarButton({ icon: "sap-icon://refresh", text: "Refresh", tooltip: "Refresh figures", press: () => window.location.reload() })
            ]
        });

        content.addItem(new Text({ text: "Rental Equipment Tracking & Condition Logging · SAP BTP CAP + Fiori · figures as of " +
            new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) }).addStyleClass("retclFooter"));
        content.addStyleClass("retclContainer");

        const page = new Page({ showHeader: true, customHeader: shell, content: [content] }).addStyleClass("retclLaunchpad sapUiResponsivePadding--header sapUiResponsivePadding--content");
        page.placeAt(mountPoint(), "only");

        // Mark the attention card so the notification bell can scroll to it
        page.addEventDelegate({ onAfterRendering: () => {
            const cardsDom = document.querySelectorAll(".sapFCard");
            cardsDom.forEach(c => { if (c.textContent.includes("Needs Your Attention")) c.classList.add("retclAttention"); });
        } });
    }

    // ---------------------------------------------------------------- start
    loadXsuaaSession().then(session => {
        if (!session) {
            clearFioriSession();
            renderSignedOut();
            return;
        }
        render(session).catch(err => {
            console.error("Launchpad failed to render", err);
            new Page({ showHeader: false, content: [new MessageStrip({ type: "Error", showIcon: true,
                text: "The launchpad could not be loaded: " + err.message }).addStyleClass("sapUiMediumMargin")] })
                .placeAt(mountPoint(), "only");
        });
    });
});
