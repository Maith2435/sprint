/*
 * BILLING SERVICE  (/billing)  - logic in billing-service.js
 * Damage charges for customers: calculate -> approve / adjust / reject / dispute -> post invoice to S/4HANA.
 * Used by the apps: Damage Charge Approval, Pricing Rules.
 *
 * How to read the annotations:
 *   @path                  = URL of the OData service (e.g. /rental/Customers)
 *   @requires              = who may call it at all (roles come from xs-security.json)
 *   @restrict              = per entity: READ for some roles, '*' (create/update/delete) for others
 *   @odata.draft.enabled   = edits are saved as a draft first, then activated with "Save" (Fiori standard)
 *   @readonly              = can only be read through this service
 *   actions { ... }        = bound actions (buttons on the object page); the unbound actions at the bottom
 *                            do the actual work in the .js file (see srv/common/bound-actions.js)
 *   @Common.SideEffects    = tells the UI to reload the object after the action
 */
using { RentalEquipmentTrackingApp as my } from '../../db/schema';

@path: '/billing'
@requires:'authenticated-user'
service BillingService {

    // Damage charge (bill) with the approval workflow buttons
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['BillingClerk', 'Manager', 'Admin'] }
    ]
    entity RepairBills as projection on my.RepairBills actions {
        @Common.SideEffects: { TargetEntities: ['in'] }
        action approve(
            @title: 'Approval Notes' @UI.MultiLineText reason: String
        ) returns RepairBills;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action adjust(
            @title: 'Parts Cost (₹)' partsCost: Decimal(12,2),
            @title: 'Labour Cost (₹)' labourCost: Decimal(12,2),
            @title: 'Painting Cost (₹)' paintingCost: Decimal(12,2),
            @title: 'Reason for Adjustment' @mandatory @UI.MultiLineText reason: String
        ) returns RepairBills;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action reject(
            @title: 'Reason for Rejection' @mandatory @UI.MultiLineText reason: String
        ) returns RepairBills;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action dispute(
            @title: 'Dispute Details' @mandatory @UI.MultiLineText reason: String
        ) returns RepairBills;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action post() returns RepairBills;
    };

    // Photo evidence attached to a bill
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician'] },
        { grant: ['*'], to: ['BillingClerk', 'Manager', 'Admin', 'YardWorker', 'Technician'] }
    ]
    entity DamagePhotos as projection on my.DamagePhotos;

    // Read-only lookups used by value helps and navigation
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician'] }
    ]
    entity ConditionLogs as projection on my.ConditionLogs;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity Equipment as projection on my.Equipment;

    // Value help: the assets on a rental contract
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity ContractEquipment as select from my.RentalItems {
        key ID,
        rental,
        equipment,
        equipment.equipmentNo as equipmentNo,
        equipment.equipmentName as equipmentName,
        equipment.serialNumber as serialNumber,
        equipment.category as category,
        equipment.model as model
    };

    // Price list per damage type + severity: billing reads it, only Manager / Admin change it
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Manager', 'Admin'] }
    ]
    entity PricingRules as projection on my.PricingRules;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity DamageRecords as projection on my.DamageRecords;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity Rentals as projection on my.Rentals;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity Customers as projection on my.Customers;

    // Outbox of invoices sent to S/4HANA (simulated)
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Admin'] }
    ]
    entity IntegrationMessages as projection on my.IntegrationMessages;

    // Dropdown values (filled in billing-service.js)
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity Severities {
        key code : String(10);
    };

    // ---------- Actions (business logic in billing-service.js) ----------
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action calculateDamageCharge(damageId: UUID) returns RepairBills;
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action approveRepairBill(billId: UUID, approvalReason: String) returns RepairBills;
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action adjustRepairBill(billId: UUID, partsCost: Decimal(12,2), labourCost: Decimal(12,2), paintingCost: Decimal(12,2), reason: String) returns RepairBills;
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action rejectRepairBill(billId: UUID, reason: String) returns RepairBills;
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action disputeRepairBill(billId: UUID, reason: String) returns RepairBills;
    @requires: ['BillingClerk', 'Manager', 'Admin']
    action postInvoice(billId: UUID) returns RepairBills;
}
