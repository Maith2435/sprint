/*
 * INSPECTION SERVICE  (/inspection)  - logic in inspection-service.js
 * Condition reports at check-out (dispatch) and check-in (return), damages found, and photo evidence.
 * Used by the apps: Inspections, Damage Records.
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

@path: '/inspection'
@requires: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor']
service InspectionService {

    // Inspection report. Yard workers create it; "Submit" then "Lock" makes it read-only
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['YardWorker', 'Manager', 'Admin'] }
    ]
    entity ConditionLogs as projection on my.ConditionLogs actions {
        @Common.SideEffects: { TargetEntities: ['in'] }
        action submit() returns ConditionLogs;
        @Common.SideEffects: { TargetEntities: ['in'] }
        action lock() returns ConditionLogs;
    };

    // Damages found during an inspection
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['YardWorker', 'Technician', 'Manager', 'Admin'] }
    ]
    entity DamageRecords as projection on my.DamageRecords;

    // Photos (uploaded through POST /api/upload-evidence in srv/server.js)
    @restrict: [
        { grant: ['READ'], to: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['YardWorker', 'Technician', 'Manager', 'Admin'] }
    ]
    entity DamagePhotos as projection on my.DamagePhotos;

    // Read-only lookups used by value helps and navigation
    @readonly
    @cds.redirection.target
    @requires:'authenticated-user'
    entity Equipment as projection on my.Equipment;

    // Value help: the assets on a rental contract (one row per contract item)
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] }
    ]
    @cds.redirection.target: false
    entity ContractEquipment as select from my.RentalItems {
        key ID,
        rental.ID               as rental_ID,
        equipment.ID            as equipment_ID,
        equipment.equipmentNo   as equipmentNo,
        equipment.equipmentName as equipmentName,
        equipment.serialNumber  as serialNumber,
        equipment.currentStatus as currentStatus,
        equipment.currentGrade  as currentGrade
    };

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['YardWorker', 'Technician', 'Dispatcher', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity Rentals as projection on my.Rentals;

    // Dropdown values (filled in inspection-service.js)
    @readonly
    entity InspectionTypes {
        key code : String(15);
        name : String(50);
    }

    @readonly
    entity Inspectors {
        key code : String(100);
        name : String(100);
    }

    // ---------- Actions (business logic in inspection-service.js) ----------
    @requires: ['YardWorker', 'Manager', 'Admin']
    action submitInspection(conditionLogId: UUID) returns ConditionLogs;
    @requires: ['YardWorker', 'Manager', 'Admin']
    action lockInspection(conditionLogId: UUID) returns ConditionLogs;
    @requires: ['YardWorker', 'Dispatcher', 'Manager', 'Admin']
    action acknowledgeInspection(conditionLogId: UUID, signatureUrl: String) returns ConditionLogs;
}
