using { RentalService } from '../../srv/rental-service/rental-service';


/* ==========================================================================
   8. LOCATIONS & YARDS - MASTER DATA (FR-004, FR-020)
   ========================================================================== */

// Locations: screen layout (list columns, filters, object page sections)
annotate RentalService.Locations with @(
    // which related tables may be opened from here
    Capabilities.NavigationRestrictions: {
        RestrictedProperties: [
            {
                NavigationProperty: equipment,
                InsertRestrictions: { Insertable: false },
                UpdateRestrictions: { Updatable: false },
                DeleteRestrictions: { Deletable: false }
            }
        ]
    },
    // action buttons in the object page header
    UI.Identification: [
        {
            $Type: 'UI.DataFieldForAction',
            Action: 'RentalService.assignEquipment',
            Label: 'Assign Equipment'
        }
    ],
    // title shown at the top of the object page (and singular / plural names)
    UI.HeaderInfo: {
        TypeName: 'Location',
        TypeNamePlural: 'Locations',
        Title: { Value: locationName }
    },
    // filter fields in the filter bar of the list page
    UI.SelectionFields: [
        locationName,
        locationType,
        city
    ],
    // columns of the table
    UI.LineItem: [
        { Value: locationName, Label: 'Location Name' },
        { Value: plant, Label: 'Plant Code' },
        { Value: locationType, Label: 'Location Type' },
        { Value: address, Label: 'Full Address' },
        { Value: city, Label: 'City' },
        { Value: latitude, Label: 'Latitude' },
        { Value: longitude, Label: 'Longitude' }
    ],
    // sections (tabs) of the object page
    UI.Facets: [
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Location Details',
            Target: '@UI.FieldGroup#LocationInfo'
        },
        {
            $Type: 'UI.ReferenceFacet',
            Label: 'Stationed Equipment Fleet',
            Target: 'equipment/@UI.LineItem',
            ![@UI.Hidden]: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
        }
    ],
    // a group of fields, shown inside one of the sections above
    UI.FieldGroup #LocationInfo: {
        Data: [
            { Value: locationName, Label: 'Location Name' },
            { Value: plant, Label: 'Plant Code' },
            { Value: locationType, Label: 'Location Type' },
            { Value: address, Label: 'Full Address' },
            { Value: city, Label: 'City' },
            { Value: latitude, Label: 'GPS Latitude' },
            { Value: longitude, Label: 'GPS Longitude' }
        ]
    }
);

// Locations: field labels, value helps (dropdowns) and read-only / mandatory rules
annotate RentalService.Locations with {
    locationName @mandatory @title: 'Location Name' @Common.Label: 'Location Name';
    plant        @readonly  @title: 'Plant Code'    @Common.Label: 'Plant Code';
    locationType @mandatory @title: 'Location Type' @Common.Label: 'Location Type'
                 @Common.ValueListWithFixedValues: true
                 @Common.ValueList: {
                     CollectionPath: 'LocationTypes',
                     Parameters: [
                         { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: locationType, ValueListProperty: 'name' }
                     ]
                 };
    address      @mandatory @title: 'Full Address'  @Common.Label: 'Full Address';
    city         @mandatory @title: 'City'          @Common.Label: 'City';
    latitude     @mandatory @title: 'GPS Latitude'  @Common.Label: 'GPS Latitude';
    longitude    @mandatory @title: 'GPS Longitude' @Common.Label: 'GPS Longitude';
    equipment    @readonly;
};
