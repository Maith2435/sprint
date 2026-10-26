/*
 * RENTAL SERVICE  (/rental)  - logic in rental-service.js
 * Customers, depots, the equipment fleet and rental contracts (check-out / check-in / cancel).
 * Used by the apps: Customers, Locations, Equipment Fleet, Rentals.
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

@path: '/rental'
@requires:'authenticated-user'
service RentalService {

    // ---------- Master data ----------
    // Customers: Dispatcher maintains them, billing and auditors only read
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] }
    ]
    entity Customers as projection on my.Customers;

    // Depots with the equipment parked there; "Assign Equipment" moves an asset to this depot
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] }
    ]
    entity Locations as projection on my.Locations {
        *,
        @readonly equipment
    } actions {
        @Common.SideEffects: {
            TargetEntities: [ equipment ]
        }
        action assignEquipment(
            @mandatory
            @title: 'Select Equipment'
            @Common.Label: 'Select Equipment'
            @(Common.ValueList: {
                CollectionPath: 'Equipment',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: equipmentId, ValueListProperty: 'ID' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentNo' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentName' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'serialNumber' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'currentStatus' }
                ]
            })
            equipmentId: UUID,

            @title: 'Assignment Reason / Notes'
            @Common.Label: 'Assignment Reason / Notes'
            reason: String
        ) returns Locations;
    };

    // The fleet. Yard workers may only run "Transfer"; everything else is Dispatcher / Manager / Admin
    @odata.draft.enabled
    @cds.redirection.target
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] },
        { grant: ['transfer'], to: ['YardWorker'] }
    ]
    entity Equipment as projection on my.Equipment actions {
        @Common.SideEffects: { TargetEntities: ['in'] }
        action transfer(
            @title: 'Target Location' @mandatory
            @Common.ValueListWithFixedValues
            @Common.ValueList: {
                CollectionPath: 'Locations',
                Parameters: [
                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: toLocationId, ValueListProperty: 'ID' },
                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'locationName' }
                ]
            }
            toLocationId: UUID,
            @title: 'Reason for Transfer' @UI.MultiLineText reason: String
        ) returns Equipment;
    };

    // Value help for rental items: only assets that are Available (reserved ones are filtered out in the .js)
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity AvailableEquipment as projection on my.Equipment {
        ID,
        equipmentNo,
        serialNumber,
        category,
        equipmentName,
        equipmentType,
        manufacturer,
        model,
        rentalRatePerDay,
        currentStatus,
        currentGrade,
        location
    } where currentStatus = 'Available';

    // Rental contract with its items; buttons: Check Out, Check In, Cancel
    // ---------- Rental contracts ----------
    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] }
    ]
    entity Rentals as projection on my.Rentals actions {
        @Common.SideEffects: { TargetEntities: ['in', 'in/items'] }
        action checkOut() returns Rentals;
        @Common.SideEffects: { TargetEntities: ['in', 'in/items'] }
        action checkIn(
            @title: 'Actual Return Date' @mandatory actualReturnDate: Date
        ) returns Rentals;
        @Common.SideEffects: { TargetEntities: ['in', 'in/items'] }
        action cancel(
            @title: 'Cancellation Reason' @mandatory @UI.MultiLineText reason: String
        ) returns Rentals;
    };

    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] }
    ]
    entity RentalItems as projection on my.RentalItems;

    // ---------- Read-only history shown on the object pages ----------
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity RentalStatusHistory as projection on my.RentalStatusHistory;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity EquipmentTransfers as projection on my.EquipmentTransfers;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity LocationEvents as projection on my.LocationEvents;

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity AssetStatusHistory as projection on my.AssetStatusHistory;

    // Read-only inspection and repair history for the asset detail page (FR-014)
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity ConditionLogs as projection on my.ConditionLogs {
        key ID, equipment, rental, inspectionDate, inspectionType, conditionGrade,
        inspectionStatus, inspector, meterReading, notes
    };

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Technician', 'Manager', 'Admin', 'Auditor'] }
    ]
    entity RepairJobs as projection on my.RepairJobs {
        key ID, equipment, technician, labourHours, actualCost, repairDetails, status, closedAt
    };

    // Dropdown values for Location Type (filled in rental-service.js)
    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Manager', 'Admin', 'Auditor', 'Technician', 'BillingClerk'] }
    ]
    entity LocationTypes {
        key code : String(50);
        name     : String(100);
    }

    // ---------- Actions (business logic in rental-service.js) ----------
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action checkOutRental(rentalId: UUID) returns Rentals;
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action checkInRental(rentalId: UUID, actualReturnDate: Date) returns Rentals;
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action cancelRental(rentalId: UUID, reason: String) returns Rentals;
    @requires: ['YardWorker', 'Dispatcher', 'Manager', 'Admin']
    action transferEquipment(equipmentId: UUID, toLocationId: UUID, reason: String) returns Equipment;
}
