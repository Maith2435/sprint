using { RentalService } from '../../srv/rental-service/rental-service';

/* ==========================================================================
   1. RENTAL SERVICE - FLEET EQUIPMENT & ASSET DETAIL (FR-004, FR-010, FR-020)
   ========================================================================== */

// Equipment: screen layout (list columns, filters, object page sections)
annotate RentalService.Equipment with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Equipment Asset',
        TypeNamePlural: 'Equipment Assets',
        Title: { Value: equipmentName }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        equipmentNo,
        category,
        equipmentType,
        currentStatus,
        currentGrade,
        location_ID
    ],
    // columns of the table
    UI.LineItem: [
        { Value: equipmentNo, Label: 'Equipment No' },
        { Value: equipmentName, Label: 'Equipment Name' },
        {
            Value: currentStatus,
            Label: 'Status',
            Criticality: (
                currentStatus = 'Available' ? 3 :
                currentStatus = 'RentedOut' ? 2 :
                currentStatus = 'Damaged' ? 1 :
                currentStatus = 'Quarantined' ? 1 :
                currentStatus = 'InRepair' ? 2 : 0
            )
        },
        {
            Value: currentGrade,
            Label: 'Condition Grade',
            Criticality: (
                currentGrade = 'A' ? 3 :
                currentGrade = 'B' ? 2 :
                currentGrade = 'C' ? 2 : 1
            )
        },
        { Value: location.locationName, Label: 'Current Location' },
        { Value: rentalRatePerDay, Label: 'Daily Rate (₹)' },
        { Value: nextServiceDate, Label: 'Next Service' },
        { Value: category, Label: 'Category' },
        { Value: serialNumber, Label: 'Serial Number' },
        { Value: manufacturer, Label: 'Manufacturer' },
        { Value: model, Label: 'Model' }
    ],
    // key figures shown in the object page header
    UI.HeaderFacets: [
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Status'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Grade'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#RentalRate'
        }
    ],
    // a single highlighted value (used in the header)
    UI.DataPoint #Status: {
        Value: currentStatus,
        Title: 'Operational Status',
        Criticality: (
            currentStatus = 'Available' ? 3 :
            currentStatus = 'RentedOut' ? 2 :
            currentStatus = 'InRepair' ? 2 :
            currentStatus = 'Damaged' ? 1 :
            currentStatus = 'Quarantined' ? 1 : 0
        )
    },
    // a single highlighted value (used in the header)
    UI.DataPoint #Grade: {
        Value: currentGrade,
        Title: 'Condition Grade',
        Criticality: (
            currentGrade = 'A' ? 3 :
            currentGrade = 'B' ? 2 : 1
        )
    },
    // a single highlighted value (used in the header)
    UI.DataPoint #RentalRate: {
        Value: rentalRatePerDay,
        Title: 'Daily Rate'
    },
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.CollectionFacet',
            ID: 'GeneralInfoFacet',
            Label: 'Asset Overview',
            Facets: [
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'Technical Specifications',
                    Target: '@UI.FieldGroup#TechSpecs'
                },
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'Yard & Depot Details',
                    Target: '@UI.FieldGroup#LocationTelematics'
                }
            ]
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'InspectionsFacet',
            Label: 'Inspections',
            Target: 'conditionLogs/@UI.LineItem'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'RepairsFacet',
            Label: 'Repairs',
            Target: 'repairJobs/@UI.LineItem'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'StatusTimelineFacet',
            Label: 'Status Timeline',
            Target: 'statusHistory/@UI.LineItem'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'LocationHistoryFacet',
            Label: 'Location History',
            Target: 'transfers/@UI.LineItem'
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #TechSpecs: {
        Data: [
            { Value: equipmentNo, Label: 'Equipment No' },
            { Value: serialNumber, Label: 'Serial Number' },
            { Value: category, Label: 'Category' },
            { Value: equipmentType, Label: 'Type' },
            { Value: manufacturer, Label: 'Manufacturer' },
            { Value: model, Label: 'Model' },
            { Value: rentalRatePerDay, Label: 'Daily Rental Rate (₹)' },
            { Value: purchaseDate, Label: 'Purchase Date' },
            { Value: currentMeterReading, Label: 'Meter Reading (Hours)' }
        ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #LocationTelematics: {
        Data: [
            { Value: location_ID, Label: 'Depot Location' },
            { Value: custodian, Label: 'Current Custodian' },
            { Value: nextServiceDate, Label: 'Next Scheduled Service' }
        ]
    }
);

// Equipment: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.Equipment with {
    equipmentNo         @readonly @title: 'Equipment No'        @Common.Label: 'Equipment No';
    serialNumber        @readonly @title: 'Serial Number'       @Common.Label: 'Serial Number';
    equipmentName       @mandatory @title: 'Equipment Name'     @Common.Label: 'Equipment Name';
    category            @title: 'Category'                      @Common.Label: 'Category';
    equipmentType       @title: 'Equipment Type'                @Common.Label: 'Equipment Type';
    manufacturer        @title: 'Manufacturer'                  @Common.Label: 'Manufacturer';
    model               @title: 'Model'                         @Common.Label: 'Model';
    rentalRatePerDay    @title: 'Daily Rental Rate (₹)'         @Common.Label: 'Daily Rental Rate (₹)';
    currentStatus       @title: 'Operational Status'            @Common.Label: 'Operational Status';
    currentGrade        @title: 'Condition Grade'               @Common.Label: 'Condition Grade';
    currentMeterReading @title: 'Meter Reading (Hours)'         @Common.Label: 'Meter Reading (Hours)';
    location            @mandatory @title: 'Depot Location'     @Common.Label: 'Depot Location' @Common.ValueList: {
        CollectionPath: 'Locations',
        Parameters: [
            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: location_ID, ValueListProperty: 'ID' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'locationName' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'city' }
        ]
    };
    custodian           @title: 'Current Custodian'             @Common.Label: 'Current Custodian';
    purchaseDate        @title: 'Purchase Date'                 @Common.Label: 'Purchase Date';
    nextServiceDate     @title: 'Next Service Date'             @Common.Label: 'Next Service Date';
    plant               @UI.Hidden: true;
    barcode             @UI.Hidden: true;
    latitude            @UI.Hidden: true;
    longitude           @UI.Hidden: true;
};

// EquipmentTransfers: screen layout (list columns, filters, object page sections)
annotate RentalService.EquipmentTransfers with @(
    // columns of the table
    UI.LineItem: [
        { Value: transferDate, Label: 'Transfer Date' },
        { Value: fromLocation.locationName, Label: 'From Location' },
        { Value: toLocation.locationName, Label: 'To Location' },
        { Value: reason, Label: 'Reason for Transfer' }
    ]
);

// AssetStatusHistory: screen layout (list columns, filters, object page sections)
annotate RentalService.AssetStatusHistory with @(
    // columns of the table
    UI.LineItem: [
        { Value: changedAt, Label: 'Timestamp' },
        { Value: oldStatus, Label: 'Previous Status' },
        { Value: newStatus, Label: 'New Status' },
        { Value: changedBy, Label: 'Changed By' },
        { Value: reason, Label: 'Audit Reason' }
    ]
);

// Inspection and repair history on the asset detail page (FR-014)
annotate RentalService.ConditionLogs with @(
    // columns of the table
    UI.LineItem: [
        { Value: inspectionDate, Label: 'Inspection Date' },
        { Value: inspectionType, Label: 'Type' },
        {
            Value: conditionGrade,
            Label: 'Grade',
            Criticality: (conditionGrade = 'A' ? 3 : conditionGrade = 'B' ? 2 : conditionGrade = 'C' ? 2 : 1)
        },
        { Value: meterReading, Label: 'Meter (Hours)' },
        { Value: inspector, Label: 'Inspector' },
        { Value: inspectionStatus, Label: 'Review State' },
        { Value: notes, Label: 'Notes' }
    ],
    // default sorting of the table
    UI.PresentationVariant: {
        SortOrder: [ { Property: inspectionDate, Descending: true } ],
        Visualizations: [ '@UI.LineItem' ]
    }
);

// RepairJobs: screen layout (list columns, filters, object page sections)
annotate RentalService.RepairJobs with @(
    // columns of the table
    UI.LineItem: [
        { Value: closedAt, Label: 'Completed At' },
        { Value: technician, Label: 'Technician' },
        { Value: status, Label: 'Status' },
        { Value: labourHours, Label: 'Labour Hours' },
        { Value: actualCost, Label: 'Actual Cost (₹)' },
        { Value: repairDetails, Label: 'Work Performed' }
    ],
    // default sorting of the table
    UI.PresentationVariant: {
        SortOrder: [ { Property: closedAt, Descending: true } ],
        Visualizations: [ '@UI.LineItem' ]
    }
);
