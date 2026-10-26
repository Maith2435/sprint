import cds from '@sap/cds';
import { exposeBoundActions } from '../common/bound-actions.js';
import { hidePricesFromYardWorker } from '../common/hide-prices.js';
import { setEquipmentStatus } from '../common/equipment-status.js';
import { nextNumber } from '../common/numbering.js';
import { removeEmptyDraftsOnList } from '../common/drafts.js';

// Database tables (used for checks that must see all data, not just what the service exposes)
const db = {
    Rentals: 'RentalEquipmentTrackingApp.Rentals',
    RentalItems: 'RentalEquipmentTrackingApp.RentalItems',
    RentalStatusHistory: 'RentalEquipmentTrackingApp.RentalStatusHistory',
    Equipment: 'RentalEquipmentTrackingApp.Equipment',
    Locations: 'RentalEquipmentTrackingApp.Locations',
    EquipmentTransfers: 'RentalEquipmentTrackingApp.EquipmentTransfers'
};

const today = () => new Date().toISOString().slice(0, 10);                     // 'YYYY-MM-DD'

/** Rental value of one item: daily rate x number of days (at least 1 day). */
function itemAmount(item) {
    if (!item.dailyRentalRate || !item.startDate || !item.endDate) return 0;    // incomplete item counts as 0
    const days = Math.max(1, Math.ceil((new Date(item.endDate) - new Date(item.startDate)) / 86400000));
    return Number(item.dailyRentalRate) * days;
}

/** Writes one line to a contract's status history (shown on the rental's Status History tab). */
function logRentalStatus(rentalId, oldStatus, newStatus) {
    return INSERT.into(db.RentalStatusHistory).entries({ rental_ID: rentalId, oldStatus, newStatus });
}

/**
 * Rental Service: customers, depots, equipment fleet and rental contracts.
 * FRD: FR-001..FR-004 (master data, contracts, items), FR-008/009 (lifecycle, overdue), FR-010/011 (locations, transfers).
 */
export default class RentalService extends cds.ApplicationService {
    async init() {
        const { Rentals, RentalItems, Equipment, Locations } = this.entities;

        // ------------------------------------------------------------------
        // Housekeeping: drop drafts that were opened but never filled in
        // ------------------------------------------------------------------
        removeEmptyDraftsOnList(this, 'Customers', `companyName is null or companyName = ''`);
        removeEmptyDraftsOnList(this, 'Locations', `locationName is null or locationName = ''`);
        removeEmptyDraftsOnList(this, 'Equipment', `equipmentName is null and location_ID is null`);

        // Fixed list for the Location Type dropdown
        this.on('READ', 'LocationTypes', () => [
            { code: 'Yard', name: 'Yard' },
            { code: 'Depot', name: 'Depot' },
            { code: 'Workshop', name: 'Workshop' }
        ]);

        // ------------------------------------------------------------------
        // Customers (FR-001): email and phone must have a valid format.
        // Required fields themselves are checked by @mandatory in the data model.
        // ------------------------------------------------------------------
        this.before('SAVE', 'Customers', (req) => {
            const { email, phone } = req.data;
            if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
                req.error(400, `Invalid email address format "${email}". Please enter a valid email address (e.g. name@domain.com).`, 'email');
            }
            const digits = (phone || '').replace(/\D/g, '');                       // count digits only
            if (phone && (!/^\+?[0-9\s\-()]{7,20}$/.test(phone.trim()) || digits.length < 7 || digits.length > 15)) {
                req.error(400, `Invalid contact number format "${phone}". Please enter a valid phone number with 7 to 15 digits (e.g. +91 98765 43210 or 10-digit mobile number).`, 'phone');
            }
        });

        // ------------------------------------------------------------------
        // Locations (FR-010): new depots get the next plant code (PLANT-1010, PLANT-1020, ...)
        // ------------------------------------------------------------------
        const nextPlantCode = () => nextNumber([db.Locations], 'plant', 'PLANT-', 1000, 10);
        this.before('NEW', 'Locations.drafts', async (req) => {
            req.data.plant ??= await nextPlantCode();
        });

        // ------------------------------------------------------------------
        // Equipment (FR-004): new assets get the next asset and serial numbers
        // ------------------------------------------------------------------
        this.before('NEW', 'Equipment.drafts', async (req) => {
            req.data.equipmentNo ??= await nextNumber([db.Equipment], 'equipmentNo', 'EQ-', 1000);
            req.data.serialNumber ??= await nextNumber([db.Equipment], 'serialNumber', 'SN-', 1000);
            req.data.plant ??= 'PLANT-DEF';                                       // default plant until assigned
        });

        // ------------------------------------------------------------------
        // Rental contracts (FR-002/003)
        // ------------------------------------------------------------------
        const nextContractNo = () => nextNumber([db.Rentals, 'RentalService.Rentals.drafts'], 'contractNo', 'RENT-', 10000);

        // A new contract gets its number and starts as "Booked"
        this.before('NEW', 'Rentals.drafts', async (req) => {
            req.data.contractNo ??= await nextContractNo();
            req.data.rentalStatus ??= 'Booked';
        });

        /**
         * Returns an error text if the asset cannot be put on this contract, otherwise null.
         * Rules: asset must exist, be Available, not be on this contract twice,
         * and not be reserved on another contract (saved or still in draft).
         */
        async function whyNotRentable(equipmentId, rentalId, itemId) {
            const asset = await SELECT.one.from(db.Equipment).where({ ID: equipmentId });
            if (!asset) return 'Selected equipment does not exist.';
            if (asset.currentStatus !== 'Available') {
                return `Equipment "${asset.equipmentName}" (${asset.serialNumber}) cannot be allocated because its operational status is "${asset.currentStatus}". Only Available equipment can be rented.`;
            }
            const sameContract = await SELECT.one.from('RentalService.RentalItems.drafts')   // twice on this contract?
                .where({ rental_ID: rentalId, equipment_ID: equipmentId, ID: { '!=': itemId } });
            if (sameContract) return `Equipment "${asset.equipmentName}" is already allocated in this contract. Please select a different equipment.`;
            const otherContract = await SELECT.one.from(db.RentalItems)                       // reserved elsewhere?
                .where({ equipment_ID: equipmentId, rental_ID: { '!=': rentalId }, itemStatus: { in: ['Reserved', 'OutOnRent'] } });
            if (otherContract) return `Equipment "${asset.equipmentName}" is already booked under another contract. An equipment cannot be assigned while it is booked or out on rent.`;
            return null;                                                                     // OK to rent
        }

        // New item row: copy the contract's dates and default status
        this.before('NEW', 'RentalItems.drafts', async (req) => {
            req.data.itemStatus ??= 'Reserved';
            const rentalId = req.data.rental_ID || req.params[0]?.ID;                         // parent contract
            const contract = await SELECT.one.from('RentalService.Rentals.drafts').where({ ID: rentalId });
            req.data.startDate ??= contract?.rentalDate;
            req.data.endDate ??= contract?.expectedReturnDate;
        });

        // Item edited in the draft: validate the asset, copy its daily rate, recalculate the contract total
        this.before('UPDATE', 'RentalItems.drafts', async (req) => {
            const itemId = req.data.ID || req.params.at(-1)?.ID;                              // key of the edited row
            const item = await SELECT.one.from('RentalService.RentalItems.drafts').where({ ID: itemId });
            if (!item) return;
            if (req.data.equipment_ID && req.data.equipment_ID !== item.equipment_ID) {      // asset changed
                const problem = await whyNotRentable(req.data.equipment_ID, item.rental_ID, item.ID);
                if (problem) return req.error(400, problem, 'equipment_ID');
                const asset = await SELECT.one.from(db.Equipment).columns('rentalRatePerDay').where({ ID: req.data.equipment_ID });
                req.data.dailyRentalRate = asset.rentalRatePerDay;                           // default rate from the asset
            }
            const edited = { ...item, ...req.data };                                         // item as it will be after this edit
            const others = await SELECT.from('RentalService.RentalItems.drafts').where({ rental_ID: item.rental_ID, ID: { '!=': item.ID } });
            const total = [edited, ...others].reduce((sum, i) => sum + itemAmount(i), 0);    // sum of all items
            if (total > 0) await UPDATE('RentalService.Rentals.drafts').set({ totalRentalAmount: total }).where({ ID: item.rental_ID });
        });

        // Saving a contract: needs at least one item, each asset once and rentable; the contract becomes Active
        this.before('SAVE', 'Rentals', async (req) => {
            const items = req.data.items || [];
            if (!items.length) return req.error(400, 'At least one equipment item must be allocated to create a contract.', 'items');
            const seen = new Set();
            for (const item of items) {
                if (seen.has(item.equipment_ID)) return req.error(400, 'The same equipment is added more than once. Duplicate equipment allocations are not allowed in the same contract.', 'items');
                seen.add(item.equipment_ID);
                const problem = await whyNotRentable(item.equipment_ID, req.data.ID, item.ID);
                if (problem) req.error(400, problem, 'items');
            }
            req.data.rentalStatus = 'Active';                                                // saved contract is live
            req.data.totalRentalAmount = items.reduce((sum, i) => sum + itemAmount(i), 0) || req.data.totalRentalAmount;
        });

        // After a new contract is saved: its items go out on rent and the assets become RentedOut.
        // (Saving a draft fires CREATE on the active entity; the handler gets only the key, so we re-read the contract.)
        this.after('CREATE', 'Rentals', async (_, req) => {
            const contract = await SELECT.one.from(db.Rentals).where({ ID: req.data.ID });
            if (contract?.rentalStatus !== 'Active') return;                                 // only for activated contracts
            await UPDATE(db.RentalItems).set({ itemStatus: 'OutOnRent' }).where({ rental_ID: contract.ID });
            const items = await SELECT.from(db.RentalItems).where({ rental_ID: contract.ID });
            for (const item of items) {
                await setEquipmentStatus(item.equipment_ID, 'RentedOut', `Allocated under contract ${contract.contractNo}`);
            }
            await logRentalStatus(contract.ID, 'Booked', 'Active');
        });

        // FR-009: active contracts past their expected return date are flagged Overdue (checked at most once a minute)
        let lastOverdueCheck = 0;
        this.before('READ', 'Rentals', async () => {
            if (Date.now() - lastOverdueCheck < 60000) return;
            lastOverdueCheck = Date.now();
            const late = await SELECT.from(db.Rentals).columns('ID').where({ rentalStatus: 'Active', expectedReturnDate: { '<': today() } });
            for (const { ID } of late) {
                await UPDATE(db.Rentals).set({ rentalStatus: 'Overdue' }).where({ ID });
                await logRentalStatus(ID, 'Active', 'Overdue');
            }
        });

        // Value help "available equipment": the view already filters status Available;
        // here we also hide assets that are reserved or out on rent on any contract
        this.before('READ', 'AvailableEquipment', async (req) => {
            const reserved = await SELECT.from(db.RentalItems).columns('equipment_ID')
                .where({ itemStatus: { in: ['Reserved', 'OutOnRent'] }, equipment_ID: { '!=': null } });
            const ids = reserved.map(r => r.equipment_ID);
            if (ids.length) req.query.where({ ID: { 'not in': ids } });
        });

        // ------------------------------------------------------------------
        // Contract workflow actions (buttons: Check Out, Check In, Cancel)
        // ------------------------------------------------------------------

        // Check Out: a Booked contract becomes Active and its assets go out on rent
        this.on('checkOutRental', async (req) => {
            const { rentalId } = req.data;
            const contract = await SELECT.one.from(Rentals).where({ ID: rentalId });
            if (!contract) return req.error(404, `Rental ${rentalId} not found`);
            if (contract.rentalStatus !== 'Booked') return req.error(400, `Only Booked rentals can be checked out. Current status: ${contract.rentalStatus}`);

            await UPDATE(Rentals).set({ rentalStatus: 'Active' }).where({ ID: rentalId });
            await logRentalStatus(rentalId, 'Booked', 'Active');
            await UPDATE(RentalItems).set({ itemStatus: 'OutOnRent' }).where({ rental_ID: rentalId });
            for (const item of await SELECT.from(RentalItems).where({ rental_ID: rentalId })) {
                await setEquipmentStatus(item.equipment_ID, 'RentedOut', `Checked out under rental contract ${contract.contractNo}`);
            }
            return SELECT.one.from(Rentals).where({ ID: rentalId });
        });

        // Check In: an Active/Overdue contract is returned; assets wait for the yard inspection
        this.on('checkInRental', async (req) => {
            const { rentalId, actualReturnDate } = req.data;
            const contract = await SELECT.one.from(Rentals).where({ ID: rentalId });
            if (!contract) return req.error(404, `Rental ${rentalId} not found`);
            if (!['Active', 'Overdue'].includes(contract.rentalStatus)) return req.error(400, `Only Active or Overdue rentals can be checked in. Current status: ${contract.rentalStatus}`);

            await UPDATE(Rentals).set({ rentalStatus: 'Returned', actualReturnDate: actualReturnDate || today() }).where({ ID: rentalId });
            await logRentalStatus(rentalId, contract.rentalStatus, 'Returned');
            await UPDATE(RentalItems).set({ itemStatus: 'Returned' }).where({ rental_ID: rentalId });
            for (const item of await SELECT.from(RentalItems).where({ rental_ID: rentalId })) {
                await setEquipmentStatus(item.equipment_ID, 'ReturnedPendingInspection', `Returned from rental contract ${contract.contractNo}`);
            }
            return SELECT.one.from(Rentals).where({ ID: rentalId });
        });

        // Cancel: the contract is cancelled and its assets are free again
        this.on('cancelRental', async (req) => {
            const { rentalId, reason } = req.data;
            const contract = await SELECT.one.from(Rentals).where({ ID: rentalId });
            if (!contract) return req.error(404, `Rental ${rentalId} not found`);

            await UPDATE(Rentals).set({ rentalStatus: 'Cancelled' }).where({ ID: rentalId });
            await logRentalStatus(rentalId, contract.rentalStatus, 'Cancelled');
            await UPDATE(RentalItems).set({ itemStatus: 'Returned' }).where({ rental_ID: rentalId });
            for (const item of await SELECT.from(RentalItems).where({ rental_ID: rentalId })) {
                await setEquipmentStatus(item.equipment_ID, 'Available', `Contract ${contract.contractNo} cancelled${reason ? ': ' + reason : ''}`);
            }
            return SELECT.one.from(Rentals).where({ ID: rentalId });
        });

        // ------------------------------------------------------------------
        // Moving assets between depots (FR-011)
        // ------------------------------------------------------------------

        /** Moves an asset to another location and records the transfer. */
        async function moveAsset(equipmentId, toLocationId, reason) {
            const asset = await SELECT.one.from(db.Equipment).columns('location_ID').where({ ID: equipmentId });
            await INSERT.into(db.EquipmentTransfers).entries({
                equipment_ID: equipmentId, fromLocation_ID: asset.location_ID, toLocation_ID: toLocationId, reason
            });
            await UPDATE(db.Equipment).set({ location_ID: toLocationId }).where({ ID: equipmentId });
        }

        // Transfer (button on an asset): move it to the chosen location
        this.on('transferEquipment', async (req) => {
            const { equipmentId, toLocationId, reason } = req.data;
            if (!await SELECT.one.from(Equipment).where({ ID: equipmentId })) return req.error(404, `Equipment ${equipmentId} not found`);
            await moveAsset(equipmentId, toLocationId, reason || 'Relocation transfer');
            return SELECT.one.from(Equipment).where({ ID: equipmentId });
        });

        // Assign Equipment (button on a depot): station the chosen asset at this depot
        this.on('assignEquipment', 'Locations', async (req) => {
            const locationId = req.params[0].ID;
            const { equipmentId, reason } = req.data;
            const depot = await SELECT.one.from(Locations).where({ ID: locationId });
            if (!depot) return req.error(404, 'Depot Location not found');
            if (!await SELECT.one.from(Equipment).where({ ID: equipmentId })) return req.error(404, 'Equipment not found');
            await moveAsset(equipmentId, locationId, reason || `Assigned to ${depot.locationName}`);
            return SELECT.one.from(Locations).where({ ID: locationId });
        });

        // Workflow buttons on the selected record (bound actions forward to the actions above)
        exposeBoundActions(this, 'Rentals', {
            checkOut: ['checkOutRental', 'rentalId'],
            checkIn: ['checkInRental', 'rentalId'],
            cancel: ['cancelRental', 'rentalId']
        });
        exposeBoundActions(this, 'Equipment', {
            transfer: ['transferEquipment', 'equipmentId']
        });

        hidePricesFromYardWorker(this);                                                     // FRD: no prices for yard workers
        await super.init();
    }
}
