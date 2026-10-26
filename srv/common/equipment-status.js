import cds from '@sap/cds';

const { SELECT, UPDATE, INSERT } = cds.ql;
const Equipment = 'RentalEquipmentTrackingApp.Equipment';               // equipment master table
const AssetStatusHistory = 'RentalEquipmentTrackingApp.AssetStatusHistory'; // audit trail of status changes

/**
 * Changes an asset's operational status and records the change in the status history.
 * Used by every workflow that moves equipment (rent out, return, inspect, repair, release).
 *
 * @param {string} equipmentId  asset to change
 * @param {string} newStatus    e.g. 'RentedOut', 'Damaged', 'Available'
 * @param {string} reason       why it changed (shown in the asset's Status Timeline)
 * @param {object} [extra]      other equipment fields to update at the same time (e.g. grade)
 */
export async function setEquipmentStatus(equipmentId, newStatus, reason, extra = {}) {
    if (!equipmentId) return;                                                     // nothing to do without an asset
    const asset = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: equipmentId }); // current status
    if (!asset) return;                                                           // unknown asset: ignore
    await UPDATE(Equipment).set({ currentStatus: newStatus, ...extra }).where({ ID: equipmentId });    // apply new status
    await INSERT.into(AssetStatusHistory).entries({                               // log old -> new for the timeline
        equipment_ID: equipmentId,
        oldStatus: asset.currentStatus,
        newStatus,
        reason
    });
}
