using { MaintenanceService } from '../../srv/maintenance-service/maintenance-service';

/* ==========================================================================
   4. MAINTENANCE SERVICE - WORKSHOP & REPAIRS (FR-012, FR-013)
   ========================================================================== */

// RepairJobs: screen layout (list columns, filters, object page sections)
annotate MaintenanceService.RepairJobs with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Workshop Repair Job',
        TypeNamePlural: 'Workshop Repair Jobs',
        Title: { Value: equipment_ID },
        Description: { Value: status }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        status,
        technician,
        equipment_ID
    ],
    // columns of the table
    UI.LineItem: [
        { Value: equipment.equipmentName, Label: 'Asset' },
        { Value: equipment.serialNumber, Label: 'Serial' },
        { Value: technician, Label: 'Assigned Technician' },
        { Value: labourHours, Label: 'Actual Hours' },
        { Value: actualCost, Label: 'Actual Repair Cost (₹)' },
        {
            Value: status,
            Label: 'Status',
            Criticality: (
                status = 'Completed' ? 3 :
                status = 'InProgress' ? 2 : 1
            )
        },
        { Value: repairDetails, Label: 'Work Performed Details' },
        { Value: beforePhotoUrl, Label: 'Before Photo' },
        { Value: afterPhotoUrl, Label: 'After Photo' },
        { Value: closedAt, Label: 'Completed At' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Repair Job Specifications',
            Target: '@UI.FieldGroup#RepairDetails'
        }
    ],
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #DamageSelected: {
        SourceProperties: [ damage_ID ],
        TargetProperties: [ equipment_ID, actualCost ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #RepairDetails: {
        Data: [
            { Value: equipment_ID, Label: 'Equipment Asset' },
            { Value: damage_ID, Label: 'Damage Reference' },
            { Value: technician, Label: 'Lead Technician' },
            { Value: labourHours, Label: 'Labour Hours' },
            { Value: actualCost, Label: 'Material & Labor Cost (₹)' },
            { Value: status, Label: 'Job Status' },
            { Value: repairDetails, Label: 'Technician Work Log' },
            { Value: beforePhotoUrl, Label: 'Pre-Repair Photo URL' },
            { Value: afterPhotoUrl, Label: 'Post-Repair Evidence URL' },
            { Value: closedAt, Label: 'Completion Timestamp' }
        ]
    }
);

// RepairJobs: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate MaintenanceService.RepairJobs with {
    equipment      @title: 'Equipment Asset'          @Common.Label: 'Equipment Asset'
                   @Common.Text: equipment.equipmentName @Common.TextArrangement: #TextOnly
                   @Common.ValueList: {
                       CollectionPath: 'DamagedEquipment',
                       Parameters: [
                           { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: equipment_ID, ValueListProperty: 'ID' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentName' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'serialNumber' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'currentStatus' }
                       ]
                   };
    damage         @title: 'Damage Reference'         @Common.Label: 'Damage Reference'
                   @Common.ValueList: {
                       CollectionPath: 'DamageRecords',
                       Parameters: [
                           { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: damage_ID, ValueListProperty: 'ID' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'damageType' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'area' },
                           { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'severity' }
                       ]
                   };
    technician     @title: 'Lead Technician'          @Common.Label: 'Lead Technician';
    labourHours    @title: 'Labour Hours'             @Common.Label: 'Labour Hours';
    actualCost     @title: 'Material & Labor Cost (₹)' @Common.Label: 'Material & Labor Cost (₹)';
    status         @title: 'Job Status'               @Common.Label: 'Job Status';
    repairDetails  @title: 'Technician Work Log'      @Common.Label: 'Technician Work Log';
    beforePhotoUrl @title: 'Pre-Repair Photo URL'     @Common.Label: 'Pre-Repair Photo URL';
    afterPhotoUrl  @title: 'Post-Repair Evidence URL' @Common.Label: 'Post-Repair Evidence URL';
    closedAt       @title: 'Completion Timestamp'     @Common.Label: 'Completion Timestamp';
};

// DamagedEquipment: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate MaintenanceService.DamagedEquipment with {
    equipmentName @title: 'Equipment Name'     @Common.Label: 'Equipment Name';
    serialNumber  @title: 'Serial Number'      @Common.Label: 'Serial Number';
    currentStatus @title: 'Operational Status' @Common.Label: 'Operational Status';
    currentGrade  @title: 'Condition Grade'    @Common.Label: 'Condition Grade';
};
