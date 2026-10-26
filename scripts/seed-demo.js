import cds from '@sap/cds';

/**
 * Adds demo records on top of the base seed (scripts/seed-data.js) so every workflow
 * button has something to act on. Additive and repeatable: nothing is deleted, and a
 * record is only inserted when its fixed ID does not exist yet.
 *
 * Run against HANA:   cds bind --exec -- node scripts/seed-demo.js
 */
async function seedDemo() {
    console.log('==== ADDING DEMO DATA (additive, no deletes) ====');

    const model = await cds.load(['db', 'srv']);
    cds.model = model;
    if (cds.service.bindings) await cds.service.bindings;
    const db = await cds.connect.to('db', { model });
    console.log(`[CONNECTED] Database kind: ${db.kind}`);

    const ns = 'RentalEquipmentTrackingApp.';
    let added = 0, skipped = 0;

    // Inserts each entry whose ID is not in the table yet
    async function add(entity, label, entries) {
        for (const entry of entries) {
            const exists = await db.run(SELECT.one.from(ns + entity).columns('ID').where({ ID: entry.ID }));
            if (exists) { skipped++; continue; }
            await db.run(INSERT.into(ns + entity).entries(entry));
            added++;
        }
        console.log(`  -> ${label}`);
    }

    // Base seed records referenced below
    const loc = { ahmedabad: '10000000-0000-0000-0000-000000000001', mumbai: '10000000-0000-0000-0000-000000000002',
                  delhi: '10000000-0000-0000-0000-000000000003', bangalore: '10000000-0000-0000-0000-000000000004' };
    const cust = { titan: '20000000-0000-0000-0000-000000000003', highways: '20000000-0000-0000-0000-000000000004' };
    const eq = n => '30000000-0000-0000-0000-00000000000' + n;

    const missing = await db.run(SELECT.one.from(ns + 'Equipment').columns('ID').where({ ID: eq(1) }));
    if (!missing) throw new Error('Base data not found. Run scripts/seed-data.js first.');

    // Demo IDs (prefix d...)
    const rentBooked = 'd4000000-0000-0000-0000-000000000001';
    const rentOverdue = 'd4000000-0000-0000-0000-000000000002';
    const rentReturned = 'd4000000-0000-0000-0000-000000000003';
    const inspection = 'd5000000-0000-0000-0000-000000000001';
    const damage = 'd6000000-0000-0000-0000-000000000001';

    // 1. Booked contract -> "Check Out" (Dispatcher)
    await add('Rentals', 'Booked contract RC-DEMO-1101 (try Check Out)', [{
        ID: rentBooked, contractNo: 'RC-DEMO-1101', customer_ID: cust.highways,
        rentalDate: '2026-10-29', expectedReturnDate: '2026-11-12', rentalStatus: 'Booked', totalRentalAmount: 91000.00
    }]);
    await add('RentalItems', 'Reserved item EQ-1006 on RC-DEMO-1101', [{
        ID: 'd4100000-0000-0000-0000-000000000001', rental_ID: rentBooked, equipment_ID: eq(6),
        dailyRentalRate: 6500.00, startDate: '2026-10-29', endDate: '2026-11-12', itemStatus: 'Reserved'
    }]);

    // 2. Active contract past its return date -> shows as Overdue, "Check In" (Dispatcher)
    await add('Rentals', 'Active contract RC-DEMO-1015 due 22 Oct (becomes Overdue)', [{
        ID: rentOverdue, contractNo: 'RC-DEMO-1015', customer_ID: cust.titan,
        rentalDate: '2026-10-05', expectedReturnDate: '2026-10-22', rentalStatus: 'Active', totalRentalAmount: 136000.00
    }]);
    await add('RentalItems', 'On-rent item EQ-1001 on RC-DEMO-1015', [{
        ID: 'd4100000-0000-0000-0000-000000000002', rental_ID: rentOverdue, equipment_ID: eq(1),
        dailyRentalRate: 8000.00, startDate: '2026-10-05', endDate: '2026-10-22', itemStatus: 'OutOnRent'
    }]);
    await add('RentalStatusHistory', 'Status history for RC-DEMO-1015', [{
        ID: 'd4200000-0000-0000-0000-000000000001', rental_ID: rentOverdue, oldStatus: 'Booked', newStatus: 'Active',
        changedAt: '2026-10-05T08:30:00Z', changedBy: 'Durga SaiPrasad'
    }]);
    // Keep the fleet consistent: EQ-1001 is out on that contract (only if it is still Available)
    const moved = await db.run(UPDATE(ns + 'Equipment').set({ currentStatus: 'RentedOut' }).where({ ID: eq(1), currentStatus: 'Available' }));
    if (moved) console.log('  -> EQ-1001 marked RentedOut for RC-DEMO-1015');

    // 3. Returned contract whose return inspection is still open (the charge engine needs the rental)
    await add('Rentals', 'Returned contract RC-DEMO-0930 for EQ-1003', [{
        ID: rentReturned, contractNo: 'RC-DEMO-0930', customer_ID: cust.highways,
        rentalDate: '2026-09-30', expectedReturnDate: '2026-10-26', actualReturnDate: '2026-10-26', rentalStatus: 'Returned', totalRentalAmount: 162000.00
    }]);
    await add('RentalItems', 'Returned item EQ-1003 on RC-DEMO-0930', [{
        ID: 'd4100000-0000-0000-0000-000000000003', rental_ID: rentReturned, equipment_ID: eq(3),
        dailyRentalRate: 6000.00, startDate: '2026-09-30', endDate: '2026-10-26', itemStatus: 'Returned'
    }]);

    // Unlocked draft inspection with a new damage -> "Submit Inspection" (YardWorker)
    await add('ConditionLogs', 'Open return inspection for EQ-1003 (try Submit Inspection)', [{
        ID: inspection, equipment_ID: eq(3), rental_ID: rentReturned, inspectionDate: '2026-10-26T10:15:00Z', inspectionType: 'CheckIn',
        conditionGrade: 'C', suggestedGrade: 'C', inspectionStatus: 'Draft', inspector: 'Kesav Maradani',
        meterReading: 2140.00, notes: 'Returned from site: left track chain torn, heavy mud on undercarriage.',
        customerAck: false, locked: false
    }]);

    // 4. Reported damage on that inspection -> "Generate Charge from Damage" (BillingClerk)
    // damageType + severity match a seeded pricing rule, so the charge engine prices it properly
    await add('DamageRecords', 'Reported damage: track chain tear (try Generate Charge)', [{
        ID: damage, conditionLog_ID: inspection, area: 'Undercarriage / Tracks', damageType: 'Track Chain Tear',
        description: 'Left track chain torn at two links; machine was tracked over rebar on site.', severity: 'Critical', origin: 'NEW',
        billable: true, repairEstimate: 26000.00, customerLiable: true, liableParty_ID: cust.highways,
        preExisting: false, damageStatus: 'Reported'
    }]);

    // 5. Bill waiting for a decision -> "Approve / Adjust / Reject / Dispute" (BillingClerk)
    await add('RepairBills', 'Bill INV-2026-2001 pending approval (try Approve / Dispute)', [{
        ID: 'd8000000-0000-0000-0000-000000000001', invoiceNo: 'INV-2026-2001', rental_ID: '40000000-0000-0000-0000-000000000003',
        customer_ID: cust.titan, equipment_ID: eq(4), severity: 'High', damageType: 'Cracked Boom Cylinder Mount',
        damageDescription: 'Boom cylinder mounting bracket cracked; operator overload suspected.', area: 'Boom / Hydraulics',
        origin: 'NEW', inspectionRef: 'Return inspection RC-2026-0815', billDate: '2026-10-25',
        partsCost: 22000.00, labourCost: 9000.00, paintingCost: 4000.00, repairAmount: 35000.00, taxAmount: 6300.00,
        totalAmount: 41300.00, billingStatus: 'PendingApproval', approvalReason: 'Above auto-approval limit: needs clerk/manager review'
    }]);

    // 6. Open repair job -> "Complete Repair" then "Release to Fleet" (Technician)
    await add('RepairJobs', 'Open repair job for EQ-1005 (try Complete Repair)', [{
        ID: 'd9000000-0000-0000-0000-000000000001', equipment_ID: eq(5), technician: 'Rohan Thakre',
        repairDetails: 'Track tensioner replacement and undercarriage inspection.', status: 'Open'
    }]);

    // 7. Upcoming service -> "Complete Service" (Technician)
    await add('MaintenanceRecords', 'Planned service for EQ-1007 on 3 Nov (try Complete Service)', [{
        ID: 'd9100000-0000-0000-0000-000000000001', equipment_ID: eq(7), maintenanceType: 'Preventive',
        maintenanceDate: '2026-11-03', nextMaintenanceDate: '2027-02-03', serviceProvider: 'Wacker Neuson Service Bangalore',
        description: '500-hour service: engine oil, air filter, vibration plate inspection.', cost: 12000.00, status: 'Planned'
    }]);

    // 8. History so timelines and "Recent Asset Activity" have content
    await add('EquipmentTransfers', '2 equipment transfers', [
        { ID: 'da000000-0000-0000-0000-000000000001', equipment_ID: eq(5), fromLocation_ID: loc.delhi, toLocation_ID: loc.mumbai,
          transferDate: '2026-10-18T07:00:00Z', reason: 'Moved to Mumbai workshop for track repair' },
        { ID: 'da000000-0000-0000-0000-000000000002', equipment_ID: eq(6), fromLocation_ID: loc.mumbai, toLocation_ID: loc.ahmedabad,
          transferDate: '2026-10-20T09:30:00Z', reason: 'Staged at Ahmedabad yard for upcoming highway contract' }
    ]);
    await add('AssetStatusHistory', '6 asset status changes', [
        { ID: 'db000000-0000-0000-0000-000000000001', equipment_ID: eq(1), oldStatus: 'Available', newStatus: 'RentedOut',
          changedAt: '2026-10-05T08:35:00Z', changedBy: 'Durga SaiPrasad', reason: 'Checked out under RC-DEMO-1015' },
        { ID: 'db000000-0000-0000-0000-000000000002', equipment_ID: eq(4), oldStatus: 'RentedOut', newStatus: 'Damaged',
          changedAt: '2026-10-16T15:10:00Z', changedBy: 'Kesav Maradani', reason: 'Return inspection: boom cylinder mount cracked' },
        { ID: 'db000000-0000-0000-0000-000000000003', equipment_ID: eq(5), oldStatus: 'Damaged', newStatus: 'InRepair',
          changedAt: '2026-10-18T07:05:00Z', changedBy: 'Rohan Thakre', reason: 'Repair job opened: track tensioner' },
        { ID: 'db000000-0000-0000-0000-000000000004', equipment_ID: eq(8), oldStatus: 'Damaged', newStatus: 'Quarantined',
          changedAt: '2026-10-21T11:40:00Z', changedBy: 'Varshith Kumar', reason: 'Grade D: quarantined pending safety review' },
        { ID: 'db000000-0000-0000-0000-000000000005', equipment_ID: eq(7), oldStatus: 'Available', newStatus: 'UnderMaintenance',
          changedAt: '2026-10-24T06:50:00Z', changedBy: 'Rohan Thakre', reason: '500-hour service started' },
        { ID: 'db000000-0000-0000-0000-000000000006', equipment_ID: eq(3), oldStatus: 'RentedOut', newStatus: 'ReturnedPendingInspection',
          changedAt: '2026-10-26T09:55:00Z', changedBy: 'Kesav Maradani', reason: 'Returned to Ahmedabad yard, awaiting inspection' }
    ]);

    console.log(`==== DONE: ${added} record(s) added, ${skipped} already present ====`);
}

seedDemo().then(() => process.exit(0)).catch(err => {
    console.error('ERROR ADDING DEMO DATA:', err);
    process.exit(1);
});
