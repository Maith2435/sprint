/**
 * Front-end configuration shared by the launchpad and the 8 Fiori apps.
 *
 *  - apps:  the app catalogue (title, launchpad tile, UI5 namespace of the Fiori Elements app)
 *  - roles: which apps each business role may open, edit and run workflow buttons in
 *
 * The backend (@restrict rules in srv/*.cds) is the real security; this file only decides
 * what the screens show, so it must be kept in line with those rules.
 */
window.RETCL = {
    apps: {
        'rentals':                { title: 'Rental Contracts',       fullTitle: 'Rental Contracts & Allocations',  subtitle: 'Check-out & check-in', icon: 'sap-icon://sales-document',   group: 'Rental Operations',      ns: 'retcl.rentals' },
        'customer-management':    { title: 'Customer Management',    fullTitle: 'Customer Management',             subtitle: 'Customers & contacts', icon: 'sap-icon://customer',         group: 'Rental Operations',      ns: 'retcl.customermanagement' },
        'locations':              { title: 'Depots & Yards',         fullTitle: 'Depot & Yard Locations',          subtitle: 'Locations & assets',   icon: 'sap-icon://map-2',            group: 'Rental Operations',      ns: 'retcl.locations' },
        'fleet-overview':         { title: 'Fleet Overview',         fullTitle: 'Fleet Overview & Asset Detail',   subtitle: 'Status & condition',   icon: 'sap-icon://shipping-status',  group: 'Fleet & Yard',           ns: 'retcl.fleetoverview' },
        'inspections':            { title: 'Inspections',            fullTitle: 'Condition Logging & Inspections', subtitle: 'Condition logs',       icon: 'sap-icon://inspection',       group: 'Fleet & Yard',           ns: 'retcl.inspections' },
        'damage-charge-approval': { title: 'Damage Charge Approval', fullTitle: 'Damage Charge Approval',          subtitle: 'Approve & dispute',    icon: 'sap-icon://money-bills',      group: 'Billing',                ns: 'retcl.damagechargeapproval' },
        'repair-jobs':            { title: 'Workshop Repair Jobs',   fullTitle: 'Workshop Repair Jobs',            subtitle: 'Repairs & release',    icon: 'sap-icon://wrench',           group: 'Workshop & Maintenance', ns: 'retcl.repairjobs' },
        'maintenance-planner':    { title: 'Maintenance Planner',    fullTitle: 'Maintenance Planner & Schedules', subtitle: 'Due services',         icon: 'sap-icon://appointment-2',    group: 'Workshop & Maintenance', ns: 'retcl.maintenanceplanner' }
    },

    // apps = may open, edit = may create/edit/delete, act = may use workflow buttons (approve, check out, ...)
    roles: {
        Admin:        { title: 'System Administrator',             apps: '*', edit: '*', act: '*' },
        Manager:      { title: 'Operations & Fleet Director',      apps: '*', edit: '*', act: '*' },
        Dispatcher:   { title: 'Rental Dispatcher & Coordinator',  apps: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections'],
                                                                   edit: ['customer-management', 'rentals', 'locations', 'fleet-overview'],
                                                                   act: ['rentals', 'fleet-overview', 'locations'] },
        YardWorker:   { title: 'Senior Yard Inspector',            apps: ['fleet-overview', 'locations', 'inspections'],
                                                                   edit: ['inspections'], act: ['inspections', 'fleet-overview'] },
        Technician:   { title: 'Lead Workshop Technician',         apps: ['repair-jobs', 'maintenance-planner', 'fleet-overview', 'locations', 'inspections'],
                                                                   edit: ['repair-jobs', 'maintenance-planner'], act: ['repair-jobs', 'maintenance-planner'] },
        BillingClerk: { title: 'Billing & Dispute Specialist',     apps: ['customer-management', 'rentals', 'damage-charge-approval'],
                                                                   edit: ['damage-charge-approval'], act: ['damage-charge-approval'] },
        Auditor:      { title: 'Compliance & Quality Auditor (read-only)', apps: '*', edit: [], act: [] },
        None:         { title: 'No role assigned - ask an admin to assign a sprint role collection', apps: [], edit: [], act: [] }
    },

    // When a user has several role collections, the first one in this list wins
    rolePriority: ['Admin', 'Manager', 'Dispatcher', 'BillingClerk', 'Technician', 'YardWorker', 'Auditor']
};

/** True if the role's list ('*' = all apps) contains the app. */
window.RETCL.allows = (list, appId) => list === '*' || list.includes(appId);
