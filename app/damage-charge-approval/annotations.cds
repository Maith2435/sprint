using { BillingService } from '../../srv/billing-service/billing-service';

/* ==========================================================================
   2. BILLING SERVICE - DAMAGE CHARGE APPROVAL (FR-007, FR-021, FR-025)
   ========================================================================== */

// RepairBills: screen layout (list columns, filters, object page sections)
annotate BillingService.RepairBills with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Repair Bill',
        TypeNamePlural: 'Repair Bills & Damage Charges',
        Title: { Value: invoiceNo }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        billingStatus,
        customer_ID,
        billDate,
        rental_ID
    ],
    // columns of the table
    UI.LineItem: [
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.EntityContainer/calculateDamageCharge', Label: 'Generate Charge from Damage' },
        { Value: invoiceNo, Label: 'Invoice / Doc Ref' },
        { Value: customer.companyName, Label: 'Customer' },
        { Value: rental.contractNo, Label: 'Contract No' },
        {
            Value: billingStatus,
            Label: 'Billing Status',
            Criticality: (
                billingStatus = 'Approved' ? 3 :
                billingStatus = 'Posted' ? 3 :
                billingStatus = 'PendingApproval' ? 2 :
                billingStatus = 'Disputed' ? 1 :
                billingStatus = 'Rejected' ? 1 : 0
            )
        },
        { Value: totalAmount, Label: 'Total Charge (₹)' },
        { Value: billDate, Label: 'Bill Date' },
        { Value: damageType, Label: 'Damage Type' },
        { Value: partsCost, Label: 'Parts (₹)' },
        { Value: labourCost, Label: 'Labour (₹)' },
        { Value: paintingCost, Label: 'Painting (₹)' },
        { Value: repairAmount, Label: 'Subtotal (₹)' },
        { Value: taxAmount, Label: 'Tax (₹)' },
        { Value: approvalReason, Label: 'Approval / Dispute Notes' }
    ],
    // key figures shown in the object page header
    UI.HeaderFacets: [
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#BillStatus'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#TotalBill'
        }
    ],
    // a single highlighted value (used in the header)
    UI.DataPoint #BillStatus: {
        Value: billingStatus,
        Title: 'Approval Status',
        Criticality: (
            billingStatus = 'Approved' ? 3 :
            billingStatus = 'Posted' ? 3 :
            billingStatus = 'Adjusted' ? 2 :
            billingStatus = 'PendingApproval' ? 2 :
            billingStatus = 'Disputed' ? 1 :
            billingStatus = 'Rejected' ? 1 : 0
        )
    },
    // a single highlighted value (used in the header)
    UI.DataPoint #TotalBill: {
        Value: totalAmount,
        Title: 'Total Invoice Amount'
    },
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Damage Particulars',
            Target: '@UI.FieldGroup#DamageParticulars'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Cost Breakdown & Liability',
            Target: '@UI.FieldGroup#BillDetails'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Photo Evidence',
            Target: 'photos/@UI.LineItem'
        }
    ],
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #CustomerSelect: {
        SourceProperties: [ customer_ID ],
        TargetProperties: [ 'rental_ID', 'equipment_ID' ]
    },
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #RentalSelect: {
        SourceProperties: [ rental_ID ],
        TargetProperties: [ 'customer_ID', 'equipment_ID' ]
    },
    // when these fields change, the UI re-reads the listed fields (calculated by the backend)
    Common.SideEffects #CostCalculation: {
        SourceProperties: [ partsCost, labourCost, paintingCost, taxAmount ],
        TargetProperties: [ 'repairAmount', 'taxAmount', 'totalAmount' ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #DamageParticulars: {
        Label: 'Damage Particulars',
        Data: [
            { Value: severity, Label: 'Severity' },
            { Value: damageType, Label: 'Damage Classification' },
            { Value: damageDescription, Label: 'Damage Description' },
            { Value: area, Label: 'Area / Component' },
            { Value: origin, Label: 'Origin' },
            { Value: inspectionRef, Label: 'Inspection Reference' }
        ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #BillDetails: {
        Data: [
            { Value: invoiceNo, Label: 'Invoice No' },
            { Value: billDate, Label: 'Bill Date' },
            { Value: customer_ID, Label: 'Customer' },
            { Value: rental_ID, Label: 'Rental Contract' },
            { Value: equipment_ID, Label: 'Damaged Equipment' },
            { Value: partsCost, Label: 'Parts Cost (₹)' },
            { Value: labourCost, Label: 'Labour Cost (₹)' },
            { Value: paintingCost, Label: 'Painting Cost (₹)' },
            { Value: taxAmount, Label: 'Tax Amount (₹)' },
            { Value: repairAmount, Label: 'Net Repair Amount (₹)' },
            { Value: totalAmount, Label: 'Gross Total (₹)' },
            { Value: billingStatus, Label: 'Status' },
            { Value: approvalReason, Label: 'Approval Notes' }
        ]
    }
);

// ContractEquipment: screen layout (list columns, filters, object page sections)
annotate BillingService.ContractEquipment with @(
    // columns of the table
    UI.LineItem: [
        { Value: equipmentName, Label: 'Equipment Name' },
        { Value: equipmentNo, Label: 'Asset ID' },
        { Value: serialNumber, Label: 'Serial Number' },
        { Value: category, Label: 'Category' },
        { Value: model, Label: 'Model' }
    ]
);

// RepairBills: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate BillingService.RepairBills with {
    invoiceNo         @title: 'Invoice Number'           @Common.Label: 'Invoice Number' @readonly;
    equipment         @title: 'Damaged Equipment'        @Common.Label: 'Damaged Equipment'
                      @Common.Text: equipment.equipmentName @Common.TextArrangement: #TextOnly
                      @Common.ValueList: {
                          CollectionPath: 'ContractEquipment',
                          Parameters: [
                              { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: equipment_ID, ValueListProperty: 'equipment_ID' },
                              { $Type: 'Common.ValueListParameterIn',    LocalDataProperty: rental_ID,    ValueListProperty: 'rental_ID' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentNo' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'equipmentName' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'serialNumber' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'category' }
                          ]
                      };
    customer          @title: 'Customer / Client'        @Common.Label: 'Customer / Client'
                      @Common.Text: customer.companyName @Common.TextArrangement: #TextOnly
                      @Common.ValueList: {
                          CollectionPath: 'Customers',
                          Parameters: [
                              { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: customer_ID, ValueListProperty: 'ID' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'companyName' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'contactPerson' }
                          ]
                      };
    rental            @title: 'Rental Contract'          @Common.Label: 'Rental Contract'
                      @Common.Text: rental.contractNo    @Common.TextArrangement: #TextOnly
                      @Common.ValueList: {
                          CollectionPath: 'Rentals',
                          Parameters: [
                              { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: rental_ID, ValueListProperty: 'ID' },
                              { $Type: 'Common.ValueListParameterIn',    LocalDataProperty: customer_ID, ValueListProperty: 'customer_ID' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'contractNo' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'rentalStatus' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'rentalDate' },
                              { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'expectedReturnDate' }
                          ]
                      };
    severity          @title: 'Severity'                 @Common.Label: 'Severity'
                      @Common.ValueListWithFixedValues: true
                      @Common.ValueList: {
                          CollectionPath: 'Severities',
                          Parameters: [
                              { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: severity, ValueListProperty: 'code' }
                          ]
                      };
    damageType        @title: 'Damage Classification'    @Common.Label: 'Damage Classification';
    damageDescription @title: 'Damage Description'       @Common.Label: 'Damage Description' @UI.MultiLineText: true;
    area              @title: 'Area / Component'         @Common.Label: 'Area / Component';
    origin            @title: 'Origin'                   @Common.Label: 'Origin';
    inspectionRef     @title: 'Inspection Reference'     @Common.Label: 'Inspection Reference';
    billDate          @title: 'Bill Date'                @Common.Label: 'Bill Date';
    partsCost         @title: 'Parts Cost (₹)'           @Common.Label: 'Parts Cost (₹)';
    labourCost        @title: 'Labour Cost (₹)'          @Common.Label: 'Labour Cost (₹)';
    paintingCost      @title: 'Painting Cost (₹)'        @Common.Label: 'Painting Cost (₹)';
    repairAmount      @title: 'Net Repair Amount (₹)'    @Common.Label: 'Net Repair Amount (₹)' @readonly;
    taxAmount         @title: 'Tax Amount (₹)'           @Common.Label: 'Tax Amount (₹)';
    totalAmount       @title: 'Gross Total (₹)'          @Common.Label: 'Gross Total (₹)'       @readonly;
    billingStatus     @title: 'Approval Status'          @Common.Label: 'Approval Status'       @readonly;
    approvalReason    @title: 'Approval Notes'           @Common.Label: 'Approval Notes';
};

// DamagePhotos: screen layout (list columns, filters, object page sections)
annotate BillingService.DamagePhotos with @(
    Capabilities: {
        InsertRestrictions: { Insertable: true },
        DeleteRestrictions: { Deletable: true },
        UpdateRestrictions: { Updatable: true }
    },
    // columns of the table
    UI.LineItem: [
        { Value: mediaUrl, Label: 'Photo Preview' },
        { Value: fileName, Label: 'Photo Filename' },
        { Value: photoType, Label: 'Evidence Type' },
        { Value: sha256, Label: 'SHA-256 Hash' },
        { Value: uploadedAt, Label: 'Captured On' },
        { Value: uploadedBy, Label: 'Captured By' }
    ]
);

// DamagePhotos: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate BillingService.DamagePhotos with {
    fileName  @title: 'Photo Filename' @Common.Label: 'Photo Filename';
    photoType @title: 'Evidence Type'  @Common.Label: 'Evidence Type' @Common.ValueListWithFixedValues: true;
    mediaUrl  @title: 'Photo Preview / URL' @Common.Label: 'Photo Preview / URL' @UI.IsImageURL: true;
    sha256    @title: 'SHA-256 Hash'   @Common.Label: 'SHA-256 Hash';
};
