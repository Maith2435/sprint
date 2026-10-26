using { MaintenanceService } from '../../srv/maintenance-service/maintenance-service';

/* ==========================================================================
   MAINTENANCE PLANNER - SCHEDULES & RECORDS
   ========================================================================== */

// MaintenanceRecords: screen layout (list columns, filters, object page sections)
annotate MaintenanceService.MaintenanceRecords with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Maintenance Record',
        TypeNamePlural: 'Maintenance Records',
        Title: { Value: equipment_ID },
        Description: { Value: maintenanceType }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        maintenanceType,
        status,
        equipment_ID,
        maintenanceDate,
        nextMaintenanceDate
    ],
    // columns of the table
    UI.LineItem: [
        { Value: equipment.equipmentName, Label: 'Asset' },
        { Value: maintenanceType, Label: 'Service Type' },
        { Value: maintenanceDate, Label: 'Service Date' },
        { Value: serviceProvider, Label: 'Service Provider' },
        { Value: cost, Label: 'Cost (₹)' },
        {
            Value: status,
            Label: 'Status',
            Criticality: (
                status = 'Completed' ? 3 :
                status = 'InProgress' ? 2 : 1
            )
        },
        { Value: nextMaintenanceDate, Label: 'Next Due Date' },
        { Value: description, Label: 'Work Summary' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Maintenance Specifications & Planning',
            Target: '@UI.FieldGroup#MaintenanceDetails'
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #MaintenanceDetails: {
        Data: [
            { Value: equipment_ID, Label: 'Equipment Asset' },
            { Value: maintenanceType, Label: 'Maintenance Type' },
            { Value: status, Label: 'Maintenance Status' },
            { Value: maintenanceDate, Label: 'Service Date' },
            { Value: nextMaintenanceDate, Label: 'Next Due Date' },
            { Value: serviceProvider, Label: 'Service Provider / Workshop' },
            { Value: cost, Label: 'Estimated Service Cost (₹)' },
            { Value: description, Label: 'Scope of Work / Description' }
        ]
    }
);

// MaintenanceRecords: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate MaintenanceService.MaintenanceRecords with {
    equipment           @title: 'Equipment Asset'              @Common.Label: 'Equipment Asset'
                        @Common.Text: equipment.equipmentName  @Common.TextArrangement: #TextOnly
                        @Common.ValueList: {
                            CollectionPath: 'Equipment',
                            Parameters: [
                                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: equipment_ID, ValueListProperty: 'ID' },
                                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentName' },
                                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'serialNumber' },
                                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'currentStatus' }
                            ]
                        };
    maintenanceType     @title: 'Maintenance Type'             @Common.Label: 'Maintenance Type'
                        @Common.ValueListWithFixedValues;
    status              @title: 'Maintenance Status'           @Common.Label: 'Maintenance Status'
                        @Common.ValueListWithFixedValues;
    maintenanceDate     @title: 'Service Date'                 @Common.Label: 'Service Date';
    nextMaintenanceDate @title: 'Next Due Date'                @Common.Label: 'Next Due Date';
    serviceProvider     @title: 'Service Provider / Workshop'  @Common.Label: 'Service Provider / Workshop';
    cost                @title: 'Estimated Service Cost (₹)'   @Common.Label: 'Estimated Service Cost (₹)';
    description         @title: 'Scope of Work / Description'  @Common.Label: 'Scope of Work / Description';
};
