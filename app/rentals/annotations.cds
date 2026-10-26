using { RentalService } from '../../srv/rental-service/rental-service';

/* ==========================================================================
   RENTALS & CONTRACT ALLOCATIONS
   ========================================================================== */

// Rentals: screen layout (list columns, filters, object page sections)
annotate RentalService.Rentals with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Rental Contract',
        TypeNamePlural: 'Rental Contracts',
        Title: { Value: contractNo }
    },
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #ItemsChanged: {
        SourceEntities: [items],
        TargetProperties: ['totalRentalAmount']
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        contractNo,
        rentalStatus,
        customer_ID,
        rentalDate,
        expectedReturnDate
    ],
    // columns of the table
    UI.LineItem: [
        { Value: contractNo, Label: 'Contract No' },
        { Value: customer.companyName, Label: 'Customer' },
        { Value: rentalDate, Label: 'Start Date' },
        { Value: expectedReturnDate, Label: 'Expected Return' },
        {
            Value: rentalStatus,
            Label: 'Status',
            Criticality: (
                rentalStatus = 'Active' ? 2 :
                rentalStatus = 'Returned' ? 3 :
                rentalStatus = 'Booked' ? 2 :
                rentalStatus = 'Overdue' ? 1 : 0
            )
        },
        { Value: totalRentalAmount, Label: 'Contract Value (₹)' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.CollectionFacet',
            ID: 'ContractGeneralInfo',
            Label: 'Contract Information',
            Facets: [
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'General Details',
                    Target: '@UI.FieldGroup#ContractDetails'
                },
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'Rental Period & Schedule',
                    Target: '@UI.FieldGroup#RentalSchedule'
                }
            ]
        },
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Allocated Equipment Items',
            Target: 'items/@UI.LineItem'
        },
        {
            $Type: 'UI.ReferenceFacet',
            ID: 'StatusHistoryFacet',
            Label: 'Status History',
            Target: 'statusHistory/@UI.LineItem'
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #ContractDetails: {
        Data: [
            { Value: contractNo, Label: 'Contract Number' },
            { Value: customer_ID, Label: 'Customer / Client' },
            { Value: totalRentalAmount, Label: 'Total Contract Value (₹)' }
        ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #RentalSchedule: {
        Data: [
            { Value: rentalDate, Label: 'Rental Start Date' },
            { Value: expectedReturnDate, Label: 'Expected Return Date' },
            { Value: actualReturnDate, Label: 'Actual Return Date' }
        ]
    }
);

// Rentals: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.Rentals with {
    contractNo         @mandatory @readonly @title: 'Contract Number'       @Common.Label: 'Contract Number';
    customer           @title: 'Customer / Client'     @Common.Label: 'Customer / Client'
                       @Common.Text: customer.companyName @Common.TextArrangement: #TextOnly
                       @Common.ValueList: {
        CollectionPath: 'Customers',
        Parameters: [
            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: customer_ID, ValueListProperty: 'ID' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'companyName' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'contactPerson' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
        ]
    };
    rentalDate         @title: 'Start Date'            @Common.Label: 'Start Date';
    expectedReturnDate @title: 'Expected Return Date'  @Common.Label: 'Expected Return Date';
    actualReturnDate   @title: 'Actual Return Date'    @Common.Label: 'Actual Return Date' @readonly @UI.Hidden: false;
    rentalStatus       @title: 'Contract Status'       @Common.Label: 'Contract Status';
    totalRentalAmount  @title: 'Total Contract Value (₹)' @Common.Label: 'Total Contract Value (₹)';
    conditionLogs      @UI.Hidden: true;
};

// Customers: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.Customers with {
    companyName   @mandatory @title: 'Company / Business Name' @Common.Label: 'Company / Business Name';
    contactPerson @title: 'Authorized Contact Person'          @Common.Label: 'Authorized Contact Person';
    email         @mandatory @title: 'Email Address'           @Common.Label: 'Email Address' @Communication.IsEmailAddress;
    phone         @mandatory @title: 'Phone / Mobile No'       @Common.Label: 'Phone / Mobile No' @Communication.IsPhoneNumber;
    address       @title: 'Office / Yard Address'              @Common.Label: 'Office / Yard Address';
};

// Rental lifecycle log (FR-008)
annotate RentalService.RentalStatusHistory with @(
    // columns of the table
    UI.LineItem: [
        { Value: changedAt, Label: 'Changed At' },
        { Value: oldStatus, Label: 'From Status' },
        { Value: newStatus, Label: 'To Status' },
        { Value: changedBy, Label: 'Changed By' }
    ],
    // default sorting of the table
    UI.PresentationVariant: {
        SortOrder: [ { Property: changedAt, Descending: true } ],
        Visualizations: [ '@UI.LineItem' ]
    }
);

// RentalItems: screen layout (list columns, filters, object page sections)
annotate RentalService.RentalItems with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Rental Item',
        TypeNamePlural: 'Rental Items',
        Title: { Value: equipment.equipmentName }
    },
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #EquipmentChanged: {
        SourceProperties: [equipment_ID],
        TargetProperties: [
            'dailyRentalRate',
            'startDate',
            'endDate'
        ],
        TargetEntities: [equipment]
    },
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #ItemRateOrDatesChanged: {
        SourceProperties: [dailyRentalRate, startDate, endDate],
        TargetEntities: [rental]
    },
    // columns of the table
    UI.LineItem: [
        { Value: equipment_ID, Label: 'Equipment Asset' },
        {
            $Type: 'UI.DataField',
            Value: equipment.serialNumber,
            Label: 'Serial Number',
            ![@Common.FieldControl]: #ReadOnly
        },
        { Value: dailyRentalRate, Label: 'Daily Rate (₹)' },
        { Value: startDate, Label: 'Start Date' },
        { Value: endDate, Label: 'End Date' },
        { Value: itemStatus, Label: 'Item Status' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Item Details',
            Target: '@UI.FieldGroup#ItemDetails'
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #ItemDetails: {
        Data: [
            { Value: equipment_ID, Label: 'Equipment Asset' },
            { Value: dailyRentalRate, Label: 'Daily Rental Rate (₹)' },
            { Value: startDate, Label: 'Start Date' },
            { Value: endDate, Label: 'End Date' },
            { Value: itemStatus, Label: 'Item Status' }
        ]
    }
);

// RentalItems: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.RentalItems with {
    equipment       @title: 'Equipment'        @Common.Label: 'Equipment'
                    @Common.Text: equipment.equipmentName @Common.TextArrangement: #TextOnly
                    @Common.ValueList: {
        CollectionPath: 'AvailableEquipment',
        Parameters: [
            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: equipment_ID, ValueListProperty: 'ID' },
            { $Type: 'Common.ValueListParameterOut', LocalDataProperty: dailyRentalRate, ValueListProperty: 'rentalRatePerDay' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentName' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'serialNumber' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'currentStatus' },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'rentalRatePerDay' }
        ]
    };
    dailyRentalRate @title: 'Daily Rate (₹)'   @Common.Label: 'Daily Rate (₹)';
    startDate       @title: 'Start Date'       @Common.Label: 'Start Date';
    endDate         @title: 'End Date'         @Common.Label: 'End Date';
    itemStatus      @title: 'Item Status'      @Common.Label: 'Item Status';
};

// AvailableEquipment: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.AvailableEquipment with {
    equipmentName    @title: 'Equipment Name'     @Common.Label: 'Equipment Name';
    serialNumber     @title: 'Serial Number'      @Common.Label: 'Serial Number';
    currentStatus    @title: 'Operational Status' @Common.Label: 'Operational Status';
    rentalRatePerDay @title: 'Daily Rental Rate'  @Common.Label: 'Daily Rental Rate';
    category         @title: 'Category'           @Common.Label: 'Category';
    manufacturer     @title: 'Manufacturer'       @Common.Label: 'Manufacturer';
    model            @title: 'Model'              @Common.Label: 'Model';
};
