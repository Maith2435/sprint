/*
 * MAINTENANCE SERVICE  (/maintenance)  - logic in maintenance-service.js
 * Preventive maintenance and workshop repair jobs; releasing repaired assets back to Available.
 * Used by the apps: Maintenance, Repair Jobs.
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

@path: '/maintenance'
@requires:'authenticated-user'
service MaintenanceService {

    // Planned service; "Complete" records the cost and the next service date
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Technician', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Technician', 'Manager', 'Admin'] }
    ]
    entity MaintenanceRecords as projection on my.MaintenanceRecords actions {
        @Common.SideEffects: { TargetEntities: ['in'] }
        action complete(
            @title: 'Actual Cost (₹)' cost: Decimal(12,2),
            @title: 'Next Service Date' nextServiceDate: Date
        ) returns MaintenanceRecords;
    };

    // Workshop repair; "Complete" logs the work, "Release Equipment" makes the asset Available again
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Technician', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Technician', 'Manager', 'Admin'] }
    ]
    entity RepairJobs as projection on my.RepairJobs actions {
        @Common.SideEffects: { TargetEntities: ['in'] }
        action complete(
            @title: 'Labour Hours' labourHours: Decimal(5,2),
            @title: 'Actual Repair Cost (₹)' actualCost: Decimal(12,2),
            @title: 'Work Performed' @UI.MultiLineText repairDetails: String
        ) returns RepairJobs;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action releaseEquipment(
            @title: 'Release Notes' @UI.MultiLineText reason: String
        ) returns RepairJobs;
    };

    // Read-only lookups used by value helps
    @readonly
    @cds.redirection.target
    @restrict: [
        { grant: ['READ'], to: ['Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity Equipment as projection on my.Equipment;

    // Value help for repair jobs: only assets that need repair
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity DamagedEquipment as projection on my.Equipment {
        key ID,
        equipmentNo,
        serialNumber,
        category,
        equipmentName,
        currentStatus,
        currentGrade
    } where currentStatus in ('Damaged', 'InRepair', 'Quarantined');

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity DamageRecords as projection on my.DamageRecords;

    // ---------- Actions (business logic in maintenance-service.js) ----------
    @requires: ['Technician', 'Manager', 'Admin']
    action createRepairJob(damageId: UUID, technician: String) returns RepairJobs;
    @requires: ['Technician', 'Manager', 'Admin']
    action completeRepairJob(repairJobId: UUID, labourHours: Decimal(5,2), actualCost: Decimal(12,2), repairDetails: String, afterPhotoUrl: String) returns RepairJobs;
    @requires: ['Technician', 'Manager', 'Admin']
    action completeMaintenanceRecord(recordId: UUID, cost: Decimal(12,2), nextServiceDate: Date) returns MaintenanceRecords;
    @requires: ['Technician', 'Manager', 'Admin']
    action releaseEquipmentToAvailable(equipmentId: UUID, reason: String) returns Equipment;
}
