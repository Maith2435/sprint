/* ==========================================================================
   WORKFLOW BUTTONS - bound actions shown in object page headers and list toolbars
   ========================================================================== */

using { RentalService } from '../srv/rental-service/rental-service';
using { BillingService } from '../srv/billing-service/billing-service';
using { InspectionService } from '../srv/inspection-service/inspection-service';
using { MaintenanceService } from '../srv/maintenance-service/maintenance-service';

// Rental lifecycle (FR-008, FR-009)
annotate RentalService.Rentals with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'RentalService.checkOut', Label: 'Check Out' },
        { $Type: 'UI.DataFieldForAction', Action: 'RentalService.checkIn', Label: 'Check In' },
        { $Type: 'UI.DataFieldForAction', Action: 'RentalService.cancel', Label: 'Cancel Contract' }
    ]
);

// Equipment transfer between locations (FR-011)
annotate RentalService.Equipment with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'RentalService.transfer', Label: 'Transfer to Location' }
    ]
);

// Damage charge approval worklist (FRD: Approve / Adjust / Reject / Dispute)
annotate BillingService.RepairBills with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.approve', Label: 'Approve' },
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.adjust', Label: 'Adjust' },
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.reject', Label: 'Reject' },
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.dispute', Label: 'Dispute' },
        { $Type: 'UI.DataFieldForAction', Action: 'BillingService.post', Label: 'Post Invoice' }
    ]
);

// Inspection review (FR-005, FR-014)
annotate InspectionService.ConditionLogs with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'InspectionService.submit', Label: 'Submit Inspection' },
        { $Type: 'UI.DataFieldForAction', Action: 'InspectionService.lock', Label: 'Lock Evidence' }
    ]
);

// Workshop repairs and quarantine release (FRD: Technician)
annotate MaintenanceService.RepairJobs with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'MaintenanceService.complete', Label: 'Complete Repair' },
        { $Type: 'UI.DataFieldForAction', Action: 'MaintenanceService.releaseEquipment', Label: 'Release to Fleet' }
    ]
);

// Maintenance planner (FR-012, FR-013)
annotate MaintenanceService.MaintenanceRecords with @(
    UI.Identification: [
        { $Type: 'UI.DataFieldForAction', Action: 'MaintenanceService.complete', Label: 'Complete Service' }
    ]
);
