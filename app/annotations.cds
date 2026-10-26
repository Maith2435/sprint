/*
 * UI ANNOTATIONS - index of all Fiori apps.
 *
 * The Fiori Elements apps have no hand-written screens: their pages are generated from these annotations.
 * Each app folder (app/<app>/annotations.cds) describes the screens of that app:
 *   UI.LineItem         -> table columns on the list page
 *   UI.SelectionFields  -> filter bar fields
 *   UI.HeaderInfo       -> object page title
 *   UI.Facets           -> object page sections, each pointing to a UI.FieldGroup (the fields)
 *   UI.Identification   -> action buttons (see workflow-actions.cds)
 *   @Common.ValueList   -> value help (dropdown / search dialog) for a field
 *   @Common.Text        -> show a readable name instead of the technical ID
 */

using from './customer-management/annotations';
using from './fleet-overview/annotations';
using from './rentals/annotations';
using from './locations/annotations';
using from './inspections/annotations';
using from './damage-charge-approval/annotations';
using from './repair-jobs/annotations';
using from './maintenance-planner/annotations';
using from './workflow-actions';
