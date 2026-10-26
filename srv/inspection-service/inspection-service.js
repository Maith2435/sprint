import cds from '@sap/cds';
import { exposeBoundActions } from '../common/bound-actions.js';
import { hidePricesFromYardWorker } from '../common/hide-prices.js';
import { setEquipmentStatus } from '../common/equipment-status.js';
import { removeEmptyDraftsOnList } from '../common/drafts.js';

// Database tables used directly
const db = {
    Rentals: 'RentalEquipmentTrackingApp.Rentals',
    RentalItems: 'RentalEquipmentTrackingApp.RentalItems'
};
const LogDrafts = 'InspectionService.ConditionLogs.drafts';

const isCheckOut = type => type === 'CheckOut' || type === 'Dispatch';            // older data used 'Dispatch'
const isCheckIn = type => type === 'CheckIn' || type === 'Return';                // older data used 'Return'

/**
 * Status of an asset after a return inspection (FR-014/FR-015):
 * critical damage or grade D -> Quarantined, any damage or grade C -> Damaged, otherwise Available.
 */
function statusAfterReturn(grade, damages) {
    if (grade === 'D' || damages.some(d => d.severity === 'Critical')) return 'Quarantined';
    if (grade === 'C' || damages.length > 0) return 'Damaged';
    return 'Available';
}

/**
 * Inspection Service: check-out and return inspections, damages and photo evidence.
 * FRD: FR-005 (inspections), FR-006 (damages), FR-014/015 (condition history and grades), FR-018/019 (photos).
 */
export default class InspectionService extends cds.ApplicationService {
    async init() {
        const { ConditionLogs, DamageRecords } = this.entities;

        // Drop inspection drafts that were opened but never got an asset
        removeEmptyDraftsOnList(this, 'ConditionLogs', 'equipment_ID is null');

        // Fixed lists for dropdowns
        this.on('READ', 'InspectionTypes', () => [
            { code: 'CheckOut', name: 'Check-Out (Dispatch)' },
            { code: 'CheckIn', name: 'Check-In (Return from Rent)' }
        ]);
        this.on('READ', 'Inspectors', () => [
            { code: 'Kesav Maradani', name: 'Kesav Maradani (Senior Yard Inspector)' },
            { code: 'Durga SaiPrasad', name: 'Durga SaiPrasad (Rental Dispatcher)' },
            { code: 'Rohan Thakre', name: 'Rohan Thakre (Lead Workshop Technician)' },
            { code: 'Naga SaiTeja', name: 'Naga SaiTeja (System Administrator)' },
            { code: 'Varshith Kumar', name: 'Varshith Kumar (Operations & Fleet Director)' },
            { code: 'Yard Worker', name: 'Yard Worker (Yard Staff)' }
        ]);

        /**
         * Which inspection comes next for an asset on a contract: inspections alternate
         * Check-Out -> Check-In -> Check-Out ... so after a Check-Out the next one is a Check-In.
         */
        async function lastInspection(equipment_ID, rental_ID, excludeId) {
            const where = { equipment_ID, ...(rental_ID && { rental_ID }), ...(excludeId && { ID: { '!=': excludeId } }) };
            return SELECT.one.from(ConditionLogs).where(where).orderBy('createdAt desc', 'inspectionDate desc');
        }
        async function nextInspectionType(equipment_ID, rental_ID) {
            const last = equipment_ID && await lastInspection(equipment_ID, rental_ID);
            return last && isCheckOut(last.inspectionType) ? 'CheckIn' : 'CheckOut';
        }

        // ------------------------------------------------------------------
        // New inspection: defaults, contract of the asset, and the expected inspection type
        // ------------------------------------------------------------------
        this.before('NEW', 'ConditionLogs.drafts', async (req) => {
            const data = req.data;
            data.conditionGrade ??= 'A';
            data.inspector ??= 'Yard Worker';
            data.inspectionDate ??= new Date().toISOString();
            data.inspectionStatus ??= 'Draft';
            if (data.equipment_ID && !data.rental_ID) {                                   // latest contract of this asset
                const item = await SELECT.one.from(db.RentalItems).where({ equipment_ID: data.equipment_ID }).orderBy('createdAt desc');
                data.rental_ID = item?.rental_ID;
            }
            data.inspectionType ??= await nextInspectionType(data.equipment_ID, data.rental_ID);
        });

        // Editing an inspection draft: contract and asset must match; suggest the next inspection type
        this.before('UPDATE', 'ConditionLogs.drafts', async (req) => {
            const data = req.data;
            const draft = await SELECT.one.from(LogDrafts).where({ ID: data.ID || req.params.at(-1)?.ID }) || {};
            if ('rental_ID' in data) {                                                    // contract changed
                const assets = data.rental_ID ? (await SELECT.from(db.RentalItems).where({ rental_ID: data.rental_ID })).map(i => i.equipment_ID) : [];
                const asset = data.equipment_ID ?? draft.equipment_ID;
                if (asset && !assets.includes(asset)) data.equipment_ID = null;            // asset not on this contract
                else if (!asset && assets.length === 1) data.equipment_ID = assets[0];      // only one asset: pick it
            }
            const equipmentId = data.equipment_ID ?? draft.equipment_ID;
            if (equipmentId) data.inspectionType = await nextInspectionType(equipmentId, data.rental_ID ?? draft.rental_ID);
        });

        // Saving: Check-Out and Check-In must alternate per asset and contract
        this.before('SAVE', 'ConditionLogs', async (req) => {
            const { ID, equipment_ID, rental_ID, inspectionType } = req.data;
            if (!equipment_ID) return;
            const last = await lastInspection(equipment_ID, rental_ID, ID);
            if (isCheckOut(inspectionType) && last && isCheckOut(last.inspectionType)) {
                req.error(400, 'This asset is already Checked-Out under this contract. You cannot perform Check-Out again; only Check-In is allowed next.', 'inspectionType');
            }
            if (isCheckIn(inspectionType) && !(last && isCheckOut(last.inspectionType))) {
                req.error(400, 'This asset has not been Checked-Out under this contract yet. You must complete Check-Out before Check-In is allowed.', 'inspectionType');
            }
        });

        // Locked inspections are legal evidence and can no longer be changed or deleted
        this.before(['UPDATE', 'DELETE'], 'ConditionLogs', async (req) => {
            const id = req.data.ID || req.params[0]?.ID;
            const log = id && await SELECT.one.from(ConditionLogs).columns('locked').where({ ID: id });
            if (log?.locked) return req.error(403, 'This inspection report is locked and cannot be modified.');
        });

        // After an inspection is saved: update the asset (status, grade, meter) and the contract
        this.after(['CREATE', 'UPDATE'], 'ConditionLogs', async (_, req) => {
            const log = await SELECT.one.from(ConditionLogs).where({ ID: req.data.ID || req.params[0]?.ID });
            if (!log?.equipment_ID) return;
            const asset = { currentGrade: log.conditionGrade, ...(log.meterReading != null && { currentMeterReading: log.meterReading }) };
            const onContract = { rental_ID: log.rental_ID, equipment_ID: log.equipment_ID };

            if (isCheckOut(log.inspectionType)) {                                        // asset leaves the yard
                if (log.rental_ID) {
                    await UPDATE(db.Rentals).set({ rentalStatus: 'Active' }).where({ ID: log.rental_ID });
                    await UPDATE(db.RentalItems).set({ itemStatus: 'OutOnRent' }).where(onContract);
                }
                await setEquipmentStatus(log.equipment_ID, 'RentedOut', `Check-Out inspection (Grade ${log.conditionGrade})`, asset);
            } else {                                                                      // asset came back
                const damages = await SELECT.from(DamageRecords).where({ conditionLog_ID: log.ID });
                const status = statusAfterReturn(log.conditionGrade, damages);
                if (log.rental_ID) {
                    await UPDATE(db.Rentals).set({ rentalStatus: 'Returned', actualReturnDate: new Date().toISOString().slice(0, 10) }).where({ ID: log.rental_ID });
                    await UPDATE(db.RentalItems).set({ itemStatus: 'Returned' }).where(onContract);
                }
                await setEquipmentStatus(log.equipment_ID, status, `Return inspection (Grade ${log.conditionGrade}, ${damages.length} damage(s))`, asset);
            }
        });

        // ------------------------------------------------------------------
        // Damages and photos
        // ------------------------------------------------------------------

        // A new damage row starts empty so the inspector must classify it
        this.before('NEW', 'DamageRecords.drafts', (req) => {
            Object.assign(req.data, { damageType: null, area: null, severity: null, origin: null, billable: false, damageStatus: null });
        });
        // A saved damage is "Reported" until it is confirmed, repaired or billed
        this.before('SAVE', 'DamageRecords', (req) => { req.data.damageStatus ||= 'Reported'; });

        // New photo: its type follows the inspection (Check-Out -> Dispatch photo, otherwise Return photo)
        this.before('NEW', 'DamagePhotos.drafts', async (req) => {
            const logId = req.data.conditionLog_ID || req.params[0]?.ID;
            const log = await SELECT.one.from(LogDrafts).where({ ID: logId }) || await SELECT.one.from(ConditionLogs).where({ ID: logId });
            req.data.photoType ??= isCheckOut(log?.inspectionType) ? 'Dispatch' : 'Return';
        });

        // ------------------------------------------------------------------
        // Workflow actions (buttons: Submit Inspection, Lock Evidence)
        // ------------------------------------------------------------------

        // Submit: inspection is final; the asset status follows grade and damages
        this.on('submitInspection', async (req) => {
            const { conditionLogId } = req.data;
            const log = await SELECT.one.from(ConditionLogs).where({ ID: conditionLogId });
            if (!log) return req.error(404, `Condition log ${conditionLogId} not found`);
            await UPDATE(ConditionLogs).set({ inspectionStatus: 'Submitted' }).where({ ID: conditionLogId });
            const damages = await SELECT.from(DamageRecords).where({ conditionLog_ID: conditionLogId });
            const status = statusAfterReturn(log.conditionGrade, damages);
            await setEquipmentStatus(log.equipment_ID, status, `Inspection completed (Grade: ${log.conditionGrade}, Status: ${status})`, {
                currentGrade: log.conditionGrade, ...(log.meterReading != null && { currentMeterReading: log.meterReading })
            });
            return SELECT.one.from(ConditionLogs).where({ ID: conditionLogId });
        });

        // Lock: makes the inspection and its evidence read-only (FRD: immutable inspections)
        this.on('lockInspection', async (req) => {
            const { conditionLogId } = req.data;
            await UPDATE(ConditionLogs).set({ locked: true }).where({ ID: conditionLogId });
            return SELECT.one.from(ConditionLogs).where({ ID: conditionLogId });
        });

        // Acknowledge: the customer has signed the inspection
        this.on('acknowledgeInspection', async (req) => {
            const { conditionLogId, signatureUrl } = req.data;
            await UPDATE(ConditionLogs).set({ customerAck: true, signatureUrl: signatureUrl || null }).where({ ID: conditionLogId });
            return SELECT.one.from(ConditionLogs).where({ ID: conditionLogId });
        });

        // Workflow buttons on the selected inspection (bound actions forward to the actions above)
        exposeBoundActions(this, 'ConditionLogs', {
            submit: ['submitInspection', 'conditionLogId'],
            lock: ['lockInspection', 'conditionLogId']
        });

        hidePricesFromYardWorker(this);                                                     // FRD: no prices for yard workers
        await super.init();
    }
}
