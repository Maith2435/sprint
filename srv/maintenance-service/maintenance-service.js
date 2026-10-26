import cds from '@sap/cds';
import { exposeBoundActions } from '../common/bound-actions.js';
import { hidePricesFromYardWorker } from '../common/hide-prices.js';
import { setEquipmentStatus } from '../common/equipment-status.js';
import { removeEmptyDraftsOnList } from '../common/drafts.js';

// Database tables used directly
const db = {
    DamageRecords: 'RentalEquipmentTrackingApp.DamageRecords',
    ConditionLogs: 'RentalEquipmentTrackingApp.ConditionLogs'
};

/**
 * Maintenance Service: workshop repair jobs and planned maintenance.
 * FRD: FR-012/013 (maintenance records and schedule), Repair Jobs screen, Technician role (repairs, release quarantine).
 */
export default class MaintenanceService extends cds.ApplicationService {
    async init() {
        const { MaintenanceRecords, RepairJobs, Equipment, DamageRecords } = this.entities;

        // Drop drafts that were opened but never got an asset
        removeEmptyDraftsOnList(this, 'RepairJobs', 'equipment_ID is null');
        removeEmptyDraftsOnList(this, 'MaintenanceRecords', 'equipment_ID is null');

        // ------------------------------------------------------------------
        // New records: default values
        // ------------------------------------------------------------------
        this.before('NEW', 'MaintenanceRecords.drafts', (req) => {
            req.data.status ??= 'Planned';
            req.data.maintenanceType ??= 'Preventive';
            req.data.maintenanceDate ??= new Date().toISOString().slice(0, 10);
            req.data.serviceProvider ??= 'In-House Fleet Workshop';
        });
        this.before('NEW', 'RepairJobs.drafts', (req) => { req.data.status ??= 'Open'; });

        // Repair job draft: choosing a damage fills in its asset and uses the estimate as expected cost
        this.before('UPDATE', 'RepairJobs.drafts', async (req) => {
            const data = req.data;
            if (!data.damage_ID) return;
            const damage = await SELECT.one.from(db.DamageRecords).where({ ID: data.damage_ID });
            const inspection = damage?.conditionLog_ID && await SELECT.one.from(db.ConditionLogs).where({ ID: damage.conditionLog_ID });
            if (!data.equipment_ID && inspection?.equipment_ID) data.equipment_ID = inspection.equipment_ID;
            if (!data.actualCost && damage?.repairEstimate) data.actualCost = Number(damage.repairEstimate);
        });

        // After a repair job is saved: an open job puts the asset in the workshop; a completed one releases it
        this.after(['CREATE', 'UPDATE'], 'RepairJobs', async (_, req) => {
            const job = await SELECT.one.from(RepairJobs).where({ ID: req.data.ID || req.params[0]?.ID });
            if (!job?.equipment_ID) return;
            if (['Open', 'InProgress'].includes(job.status)) {
                await setEquipmentStatus(job.equipment_ID, 'InRepair', `Workshop Repair Job created (${job.technician || 'Technician'})`);
                if (job.damage_ID) await UPDATE(DamageRecords).set({ damageStatus: 'InRepair' }).where({ ID: job.damage_ID });
            } else if (job.status === 'Completed') {
                await setEquipmentStatus(job.equipment_ID, 'Available', 'Workshop Repair Job completed; asset restored to Available', { currentGrade: 'B' });
                if (job.damage_ID) await UPDATE(DamageRecords).set({ damageStatus: 'Repaired' }).where({ ID: job.damage_ID });
            }
        });

        // ------------------------------------------------------------------
        // Workflow actions (buttons: Complete Repair, Release to Fleet, Complete Service)
        // ------------------------------------------------------------------

        // Create a repair job for a damage and send the asset to the workshop
        this.on('createRepairJob', async (req) => {
            const { damageId, technician } = req.data;
            const damage = await SELECT.one.from(DamageRecords).where({ ID: damageId });
            if (!damage) return req.error(404, `Damage record ${damageId} not found`);
            const inspection = await SELECT.one.from(db.ConditionLogs).where({ ID: damage.conditionLog_ID });
            const jobId = cds.utils.uuid();
            await INSERT.into(RepairJobs).entries({
                ID: jobId, equipment_ID: inspection?.equipment_ID, damage_ID: damageId,
                technician: technician || 'Unassigned', status: 'InProgress'
            });
            await UPDATE(DamageRecords).set({ damageStatus: 'InRepair' }).where({ ID: damageId });
            await setEquipmentStatus(inspection?.equipment_ID, 'InRepair', `Repair job dispatched to ${technician || 'workshop'}`);
            return SELECT.one.from(RepairJobs).where({ ID: jobId });
        });

        // Complete Repair: record actual hours/cost/work; the damage counts as repaired
        this.on('completeRepairJob', async (req) => {
            const { repairJobId, labourHours, actualCost, repairDetails, afterPhotoUrl } = req.data;
            const job = await SELECT.one.from(RepairJobs).where({ ID: repairJobId });
            if (!job) return req.error(404, `Repair job ${repairJobId} not found`);
            await UPDATE(RepairJobs).set({
                labourHours: labourHours ?? job.labourHours,
                actualCost: actualCost ?? job.actualCost,
                repairDetails: repairDetails ?? job.repairDetails,
                afterPhotoUrl: afterPhotoUrl ?? job.afterPhotoUrl,
                status: 'Completed',
                closedAt: new Date().toISOString()
            }).where({ ID: repairJobId });
            if (job.damage_ID) await UPDATE(DamageRecords).set({ damageStatus: 'Repaired' }).where({ ID: job.damage_ID });
            return SELECT.one.from(RepairJobs).where({ ID: repairJobId });
        });

        // Complete Service: record cost and next due date (also shown on the asset)
        this.on('completeMaintenanceRecord', async (req) => {
            const { recordId, cost, nextServiceDate } = req.data;
            const record = await SELECT.one.from(MaintenanceRecords).where({ ID: recordId });
            if (!record) return req.error(404, `Maintenance record ${recordId} not found`);
            await UPDATE(MaintenanceRecords).set({
                cost: cost ?? record.cost,
                nextMaintenanceDate: nextServiceDate ?? record.nextMaintenanceDate,
                status: 'Completed'
            }).where({ ID: recordId });
            if (nextServiceDate) await UPDATE(Equipment).set({ nextServiceDate }).where({ ID: record.equipment_ID });
            return SELECT.one.from(MaintenanceRecords).where({ ID: recordId });
        });

        // Release: a repaired/quarantined asset goes back to the rentable fleet (grade reset to B)
        this.on('releaseEquipmentToAvailable', async (req) => {
            const { equipmentId, reason } = req.data;
            if (!await SELECT.one.from(Equipment).where({ ID: equipmentId })) return req.error(404, `Equipment ${equipmentId} not found`);
            await setEquipmentStatus(equipmentId, 'Available', reason || 'Released from workshop after repair and inspection', { currentGrade: 'B' });
            return SELECT.one.from(Equipment).where({ ID: equipmentId });
        });

        // Workflow buttons on the selected record (bound actions forward to the actions above)
        exposeBoundActions(this, 'MaintenanceRecords', {
            complete: ['completeMaintenanceRecord', 'recordId']
        });
        exposeBoundActions(this, 'RepairJobs', {
            complete: ['completeRepairJob', 'repairJobId']
        });

        // "Release to Fleet" on a repair job releases that job's asset
        this.on('releaseEquipment', 'RepairJobs', async (req) => {
            const job = await SELECT.one.from(RepairJobs).where({ ID: req.params[0].ID });
            if (!job) return req.error(404, 'Repair job not found');
            if (!job.equipment_ID) return req.error(400, 'This repair job has no equipment assigned');
            await this.send('releaseEquipmentToAvailable', { equipmentId: job.equipment_ID, reason: req.data.reason });
            return SELECT.one.from(RepairJobs).where({ ID: job.ID });
        });

        hidePricesFromYardWorker(this);                                                     // FRD: no prices for yard workers
        await super.init();
    }
}
