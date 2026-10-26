# RETS – Rental Equipment Tracking & Condition Logging

A **SAP CAP + Fiori Elements** application for an equipment rental company (excavators, cranes, …).
It tracks the fleet, rental contracts, inspections at dispatch and return, damages with photo evidence,
workshop repairs and the damage charges billed to customers.

---

## 1. Architecture

```
Browser ──> sprint (approuter) ──> sprint-srv (CAP Node.js) ──> HANA Cloud (HDI container "RETS")
             SAP login (XSUAA)      OData services + business       tables & views
                                    logic + the UI files
```

| Layer | What it is | Where |
|-------|-----------|-------|
| Data model | Entities (tables) and enum types | `db/schema.cds` |
| Services | OData services: which entities, which roles, which actions | `srv/*/*-service.cds` |
| Business logic | Event handlers (validations, numbering, status changes) | `srv/*/*-service.js` |
| UI | 8 Fiori Elements apps (generated from annotations) + a custom launchpad | `app/` |
| Security | Roles / scopes for XSUAA | `xs-security.json` |
| Deployment | What is deployed to BTP and how it is connected | `mta.yaml` |

---

## 2. Folder structure

```
sprint/
├── db/
│   └── schema.cds                  Data model: all entities and enum types
├── srv/
│   ├── index.cds                   Loads all services
│   ├── server.js                   Server start-up: serves the UI, photo upload endpoint
│   ├── common/                     Small helpers shared by all services
│   │   ├── equipment-status.js       change an asset's status + write the history row
│   │   ├── numbering.js              next number like RENT-10005 / INV-2026-1001
│   │   ├── drafts.js                 clean up empty drafts in list pages
│   │   ├── bound-actions.js          object-page buttons -> service actions
│   │   ├── hide-prices.js            hide prices from roles that may not see them
│   │   └── cloudinary.js             upload a photo to Cloudinary (+ SHA-256)
│   ├── rental-service/             Customers, locations, fleet, rental contracts
│   ├── inspection-service/         Inspections, damages, photos
│   ├── maintenance-service/        Maintenance and repair jobs
│   └── billing-service/            Damage charges, pricing rules, invoice posting
│       (each folder: <name>.cds = service definition, <name>.js = logic)
├── app/
│   ├── index.html                  Single entry page: shows the launchpad or one app (?app=<id>)
│   ├── annotations.cds             Index of all UI annotation files
│   ├── workflow-actions.cds        Action buttons (Check Out, Approve, …) for all apps
│   ├── launchpad/main.js           Home page: key figures, app tiles, attention list
│   ├── shared/                     Code used by every app
│   │   ├── config.js                 list of apps + what each role may open / edit
│   │   ├── session.js                who is logged in (/user-api/currentUser) + CSRF helper
│   │   ├── app-shell.js              header bar, "no access" page, hides buttons per role
│   │   ├── photo-evidence.js         camera / photo upload dialog
│   │   ├── Component.js              the UI5 component used by all Fiori apps
│   │   └── styles.css
│   └── <app>/                      One folder per Fiori app
│       ├── annotations.cds           screen layout: columns, filters, sections, value helps
│       └── webapp/manifest.json      app descriptor (service URL, pages)
├── scripts/
│   ├── seed-data.js                Base test data   (npm run seed)
│   ├── seed-demo.js                Extra demo data  (npm run seed:demo, only adds)
│   ├── copy-ui.js                  Build step: ships app/ with the backend
│   └── dev-router.mjs              Local stand-in for the approuter (role switching)
├── .deploy/app-router/             Approuter (SAP login, routes in xs-app.json)
├── xs-security.json                Roles for XSUAA
├── mta.yaml                        BTP deployment descriptor
└── package.json
```

---

## 3. Roles

| Role | Can do |
|------|--------|
| **Admin / Manager** | Everything |
| **Dispatcher** | Customers, locations, fleet, rental contracts (check out / check in / cancel) |
| **YardWorker** | Inspections, damages, photos; transfer equipment between depots |
| **Technician** | Repair jobs, maintenance, release repaired equipment |
| **BillingClerk** | Damage charges: calculate, approve, adjust, reject, dispute, post invoice |
| **Auditor** | Read-only access to everything |

The backend enforces this with `@requires` / `@restrict` in the service `.cds` files.
The UI uses the same matrix (`app/shared/config.js`) to show only the allowed tiles and buttons.

---

## 4. Main business flow

```
Rental saved ──> asset RentedOut
   │
Check-out inspection ──> contract Active
   │
Check-in inspection ──> no damage: asset Available
   │                    damage:    asset Damaged ──> Repair Bill (charge to customer)
   │                                                  └─> approve ──> post invoice (S/4HANA, simulated)
Repair job opened ──> asset InRepair
Repair job completed ──> asset Available
```

Every status change of an asset is written to `AssetStatusHistory` (`srv/common/equipment-status.js`).

---

## 5. Run locally

The local server uses the real HANA database (`RETS`) through a binding (`.cdsrc-private.json`, created once with
`cds bind -2 RETS` after `cf login`):

```bash
npm install
npm run watch     # = cds watch --profile hybrid: CAP server on http://localhost:4004, data from HANA
```

To see the role-based UI, run the approuter stand-in in a second terminal:

```bash
npm run dev-router     # http://localhost:4800, switch role: /dev/role/<Role>
```

Photo upload needs Cloudinary credentials in `.env` (see `.env.example`).

---

## 6. Deploy to SAP BTP

```bash
mbt build
cf deploy mta_archives/sprint_1.0.0.mtar
```

Then assign the role collections (Admin, Dispatcher, …) to users in the BTP cockpit and set
`CLOUDINARY_URL` on the `sprint-srv` app (`cf set-env sprint-srv CLOUDINARY_URL ...`, then `cf restage sprint-srv`).
