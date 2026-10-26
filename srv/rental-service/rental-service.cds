using { RentalEquipmentTrackingApp as my } from '../../db/schema';

@path: '/rental'
@requires:'authenticated-user'
service RentalService {

    @odata.draft.enabled
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'BillingClerk', 'Manager', 'Admin', 'Auditor'] },
        { grant: ['*'], to: ['Dispatcher', 'Manager', 'Admin'] }
    ]
    entity Customers as projection on my.Customers;

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

    @readonly
    @restrict: [
        { grant: ['READ'], to: ['Dispatcher', 'YardWorker', 'Manager', 'Admin', 'Auditor', 'Technician', 'BillingClerk'] }
    ]
    entity LocationTypes {
        key code : String(50);
        name     : String(100);
    }

    // Actions restricted by role (FRD: Dispatcher checks out; YardWorker transfers)
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action checkOutRental(rentalId: UUID) returns Rentals;
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action checkInRental(rentalId: UUID, actualReturnDate: Date) returns Rentals;
    @requires: ['Dispatcher', 'Manager', 'Admin']
    action cancelRental(rentalId: UUID, reason: String) returns Rentals;
    @requires: ['YardWorker', 'Dispatcher', 'Manager', 'Admin']
    action transferEquipment(equipmentId: UUID, toLocationId: UUID, reason: String) returns Equipment;
}
