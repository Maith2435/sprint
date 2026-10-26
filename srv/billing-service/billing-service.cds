using { RentalEquipmentTrackingApp as my } from '../../db/schema';

@path: '/billing'
@requires:'authenticated-user'
service BillingService {

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

    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician'] },
        { grant: ['*'], to: ['BillingClerk', 'Manager', 'Admin', 'YardWorker', 'Technician'] }
    ]
    entity DamagePhotos as projection on my.DamagePhotos;

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

    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Admin'] }
    ]
    entity IntegrationMessages as projection on my.IntegrationMessages;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['BillingClerk', 'Manager', 'Admin', 'Auditor', 'YardWorker', 'Technician', 'Dispatcher'] }
    ]
    entity Severities {
        key code : String(10);
    };

    // Pricing Engine & Billing Approval Workflows (FRD: BillingClerk approves and disputes; Manager all approvals)
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
