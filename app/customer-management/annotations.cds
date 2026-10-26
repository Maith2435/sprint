using { RentalService } from '../../srv/rental-service/rental-service';

/* ==========================================================================
   0. CUSTOMER MANAGEMENT - MASTER DATA (STEP 1: CUSTOMER CREATION)
   ========================================================================== */

// Customers: screen layout (list columns, filters, object page sections)
annotate RentalService.Customers with @(
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Customer',
        TypeNamePlural: 'Corporate Customers',
        Title: { Value: companyName },
        Description: { Value: contactPerson }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        companyName,
        contactPerson,
        email,
        phone,
        address
    ],
    // columns of the table
    UI.LineItem: [
        { Value: companyName, Label: 'Company / Customer Name' },
        { Value: contactPerson, Label: 'Contact Person' },
        { Value: email, Label: 'Email' },
        { Value: phone, Label: 'Phone' },
        { Value: address, Label: 'Address / City' },
        { Value: createdAt, Label: 'Registered On' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.CollectionFacet',
            ID: 'CustomerGeneralInfo',
            Label: 'Customer Details',
            Facets: [
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'Corporate Profile',
                    Target: '@UI.FieldGroup#CustomerProfile'
                },
                {
                    $Type: 'UI.ReferenceFacet',
                    Label: 'Contact Information',
                    Target: '@UI.FieldGroup#ContactInfo'
                }
            ]
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #CustomerProfile: {
        Data: [
            { Value: companyName, Label: 'Company / Business Name' },
            { Value: contactPerson, Label: 'Authorized Contact Person' },
            { Value: address, Label: 'Office / Yard Address' }
        ]
    },
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #ContactInfo: {
        Data: [
            { Value: email, Label: 'Email Address' },
            { Value: phone, Label: 'Phone / Mobile No' },
            { Value: createdAt, Label: 'Created At' },
            { Value: createdBy, Label: 'Created By' }
        ]
    }
);
