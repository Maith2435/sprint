import cds from '@sap/cds';
import { exposeBoundActions } from '../common/bound-actions.js';
import { hidePricesFromYardWorker } from '../common/hide-prices.js';
import { setEquipmentStatus } from '../common/equipment-status.js';
import { nextNumber } from '../common/numbering.js';

// Database tables used directly
const db = {
    Rentals: 'RentalEquipmentTrackingApp.Rentals',
    RentalItems: 'RentalEquipmentTrackingApp.RentalItems',
    ConditionLogs: 'RentalEquipmentTrackingApp.ConditionLogs',
    DamageRecords: 'RentalEquipmentTrackingApp.DamageRecords',
    IntegrationMessages: 'RentalEquipmentTrackingApp.IntegrationMessages'
};
const BillDrafts = 'BillingService.RepairBills.drafts';

const TAX_RATE = 0.18;                                                          // 18% GST on repair charges
const round2 = n => Number(Number(n).toFixed(2));                              // money is kept to 2 decimals
const today = () => new Date().toISOString().slice(0, 10);

/** Bill amounts from its cost lines: repair = parts + labour + painting, total = repair + tax. */
function billTotals(parts, labour, painting, tax) {
    const repairAmount = round2(Number(parts || 0) + Number(labour || 0) + Number(painting || 0));
    const taxAmount = round2(tax || 0);
    return { repairAmount, taxAmount, totalAmount: round2(repairAmount + taxAmount) };
}

/**
 * Billing Service: repair bills for customer-caused damage.
 * FRD: FR-007 (repair bills), FR-021 (estimates), FR-025 (billing reports), Damage Charge Approval screen.
 */
export default class BillingService extends cds.ApplicationService {
    async init() {
        const { RepairBills, PricingRules, DamageRecords } = this.entities;
        const nextInvoiceNo = () => nextNumber([RepairBills, BillDrafts], 'invoiceNo', 'INV-2026-', 1000);

        // Fixed list for the Severity dropdown
        this.on('READ', 'Severities', () => ['Low', 'Medium', 'High', 'Critical'].map(code => ({ code })));

        // ------------------------------------------------------------------
        // New records: default values
        // ------------------------------------------------------------------
        this.before('NEW', 'RepairBills.drafts', async (req) => {
            req.data.invoiceNo ??= await nextInvoiceNo();
            req.data.billDate ??= today();
            req.data.billingStatus ??= 'Draft';
        });
        this.before('NEW', 'DamagePhotos.drafts', (req) => { req.data.photoType ??= 'Return'; });
        this.before('NEW', 'PricingRules.drafts', (req) => {
            Object.assign(req.data, {                                              // standard rate card
                severity: req.data.severity ?? 'Medium', taxPercent: 18, baseCharge: 1000,
                labourRate: 2500, partsCharge: 0, paintingCharge: 0, autoApproveLimit: 25000, ...req.data
            });
        });

        // ------------------------------------------------------------------
        // Editing a bill draft: keep customer, contract and equipment consistent and totals up to date
        // ------------------------------------------------------------------
        this.before('UPDATE', 'RepairBills.drafts', async (req) => {
            const data = req.data;
            const id = data.ID || req.params.at(-1)?.ID;
            const bill = { ...(await SELECT.one.from(BillDrafts).where({ ID: id })), ...data }; // bill after this edit

            // Customer changed: drop a contract that belongs to someone else
            if ('customer_ID' in data && bill.rental_ID) {
                const contract = await SELECT.one.from(db.Rentals).where({ ID: bill.rental_ID });
                if (contract && contract.customer_ID !== data.customer_ID) data.rental_ID = data.equipment_ID = null;
            }

            // Contract chosen: take its customer; pick its asset automatically if it has exactly one
            if ('rental_ID' in data) {
                if (!data.rental_ID) data.equipment_ID = null;                              // contract cleared
                else {
                    const contract = await SELECT.one.from(db.Rentals).where({ ID: data.rental_ID });
                    data.customer_ID ??= contract?.customer_ID;
                    const assets = (await SELECT.from(db.RentalItems).where({ rental_ID: data.rental_ID })).map(i => i.equipment_ID);
                    if (bill.equipment_ID && !assets.includes(bill.equipment_ID)) data.equipment_ID = null; // not on this contract
                    else if (!bill.equipment_ID && assets.length === 1) data.equipment_ID = assets[0];
                }
            }

            // Damage record chosen: take liable customer, contract and a cost split from the repair estimate
            if (data.damage_ID) {
                const damage = await SELECT.one.from(db.DamageRecords).where({ ID: data.damage_ID });
                const inspection = damage?.conditionLog_ID && await SELECT.one.from(db.ConditionLogs).where({ ID: damage.conditionLog_ID });
                if (damage?.liableParty_ID) data.customer_ID = damage.liableParty_ID;
                if (inspection?.rental_ID) data.rental_ID = inspection.rental_ID;
                if (damage?.repairEstimate && !data.repairAmount) {
                    const estimate = Number(damage.repairEstimate);
                    Object.assign(data, { partsCost: round2(estimate * 0.6), labourCost: round2(estimate * 0.4), paintingCost: 0 });
                    Object.assign(data, billTotals(data.partsCost, data.labourCost, 0, estimate * TAX_RATE));
                    return;                                                                  // totals already set
                }
            }

            // Any cost line or tax changed: recalculate the totals
            if (['partsCost', 'labourCost', 'paintingCost', 'taxAmount'].some(f => f in data)) {
                Object.assign(data, billTotals(bill.partsCost, bill.labourCost, bill.paintingCost, bill.taxAmount));
            }
        });

        // Saving a bill: the chosen contract must belong to the chosen customer
        this.before('SAVE', 'RepairBills', async (req) => {
            const { rental_ID, customer_ID } = req.data;
            const contract = rental_ID && await SELECT.one.from(db.Rentals).where({ ID: rental_ID });
            if (contract && contract.customer_ID !== customer_ID) {
                req.error(400, 'Selected Rental Contract does not belong to the selected Customer.', 'rental_ID');
            }
        });

        // A saved, open bill means the asset is damaged (unless already damaged or quarantined)
        this.after('CREATE', 'RepairBills', async (_, req) => {
            const bill = await SELECT.one.from(RepairBills).where({ ID: req.data.ID });
            if (!bill?.equipment_ID || ['Posted', 'Rejected'].includes(bill.billingStatus)) return;
            const asset = await SELECT.one.from('RentalEquipmentTrackingApp.Equipment').columns('currentStatus').where({ ID: bill.equipment_ID });
            if (!['Damaged', 'Quarantined'].includes(asset?.currentStatus)) {
                await setEquipmentStatus(bill.equipment_ID, 'Damaged', `Repair Bill ${bill.invoiceNo} generated for damage charges`);
            }
        });

        // ------------------------------------------------------------------
        // Pricing engine (button "Generate Charge from Damage")
        // Finds the rate card for the damage type + severity, prices the repair and creates a bill.
        // Bills up to the rule's auto-approve limit are approved immediately; larger ones need a decision.
        // ------------------------------------------------------------------
        this.on('calculateDamageCharge', async (req) => {
            const { damageId } = req.data;
            const damage = await SELECT.one.from(DamageRecords).where({ ID: damageId });
            if (!damage) return req.error(404, `Damage record ${damageId} not found`);

            const inspection = await SELECT.one.from(db.ConditionLogs).where({ ID: damage.conditionLog_ID });   // damage -> inspection
            const contract = inspection?.rental_ID && await SELECT.one.from(db.Rentals).where({ ID: inspection.rental_ID }); // -> contract
            const customerId = damage.liableParty_ID || contract?.customer_ID;                               // -> who pays
            if (!contract || !customerId) return req.error(400, 'Cannot generate bill: Missing associated Rental or Customer for this damage');

            const rule = await SELECT.one.from(PricingRules).where({ damageType: damage.damageType, severity: damage.severity })
                ?? { baseCharge: 150, partsCharge: 200, labourRate: 85, paintingCharge: 50, taxPercent: 18, autoApproveLimit: 500 }; // fallback rate card
            const parts = Number(rule.partsCharge || 0);
            const labour = Number(rule.labourRate || 0) * 2 + Number(rule.baseCharge || 0); // 2 standard labour hours + base fee
            const painting = Number(rule.paintingCharge || 0);
            const repair = parts + labour + painting;
            const totals = billTotals(parts, labour, painting, repair * Number(rule.taxPercent || 18) / 100);
            const autoApproved = totals.totalAmount <= Number(rule.autoApproveLimit || 0);

            const billId = cds.utils.uuid();
            await INSERT.into(RepairBills).entries({
                ID: billId, invoiceNo: await nextInvoiceNo(), billDate: today(),
                rental_ID: contract.ID, customer_ID: customerId, damage_ID: damageId,
                partsCost: parts, labourCost: labour, paintingCost: painting, ...totals,
                billingStatus: autoApproved ? 'Approved' : 'PendingApproval',
                approvalReason: autoApproved ? 'Auto-approved within threshold limit' : 'Pending clerk/manager review'
            });
            await UPDATE(DamageRecords).set({ damageStatus: 'Billed', repairEstimate: totals.totalAmount, customerLiable: true }).where({ ID: damageId });
            return SELECT.one.from(RepairBills).where({ ID: billId });
        });

        // ------------------------------------------------------------------
        // Approval workflow (buttons: Approve, Adjust, Reject, Dispute, Post Invoice)
        // ------------------------------------------------------------------

        /** Reads a bill; if it doesn't exist, answers 404 and returns null. */
        const findBill = async (req, billId) => {
            const bill = await SELECT.one.from(RepairBills).where({ ID: billId });
            if (!bill) req.error(404, `Bill ${billId} not found`);
            return bill;
        };
        /** Updates a bill and returns the new version. */
        const updateBill = async (billId, changes) => {
            await UPDATE(RepairBills).set(changes).where({ ID: billId });
            return SELECT.one.from(RepairBills).where({ ID: billId });
        };

        this.on('approveRepairBill', async (req) => {
            const { billId, approvalReason } = req.data;
            if (!await findBill(req, billId)) return;
            return updateBill(billId, { billingStatus: 'Approved', approvalReason: approvalReason || 'Approved by Billing Clerk' });
        });

        // Adjust: new cost lines, tax recalculated at 18%
        this.on('adjustRepairBill', async (req) => {
            const { billId, partsCost, labourCost, paintingCost, reason } = req.data;
            if (!reason) return req.error(400, 'Adjustment reason is mandatory');
            const bill = await findBill(req, billId);
            if (!bill) return;
            const parts = partsCost ?? bill.partsCost, labour = labourCost ?? bill.labourCost, painting = paintingCost ?? bill.paintingCost;
            const repair = Number(parts) + Number(labour) + Number(painting);
            return updateBill(billId, {
                partsCost: parts, labourCost: labour, paintingCost: painting,
                ...billTotals(parts, labour, painting, repair * TAX_RATE),
                billingStatus: 'Adjusted', approvalReason: reason
            });
        });

        this.on('rejectRepairBill', async (req) => {
            const { billId, reason } = req.data;
            if (!reason) return req.error(400, 'Rejection reason is mandatory');
            return updateBill(billId, { billingStatus: 'Rejected', approvalReason: reason });
        });

        this.on('disputeRepairBill', async (req) => {
            const { billId, reason } = req.data;
            if (!reason) return req.error(400, 'Dispute reason is mandatory');
            return updateBill(billId, { billingStatus: 'Disputed', approvalReason: reason });
        });

        // Post: only approved/adjusted bills; simulates the S/4HANA billing document and logs it in the outbox
        this.on('postInvoice', async (req) => {
            const { billId } = req.data;
            const bill = await findBill(req, billId);
            if (!bill) return;
            if (!['Approved', 'Adjusted'].includes(bill.billingStatus)) {
                return req.error(400, `Only Approved or Adjusted bills can be invoiced. Current status: ${bill.billingStatus}`);
            }
            const billingDocument = `INV-${Date.now().toString().slice(-8)}`;              // document number "returned by S/4"
            const contract = await SELECT.one.from(db.Rentals).where({ ID: bill.rental_ID });
            await INSERT.into(db.IntegrationMessages).entries({                            // outbox entry (Integration Monitor)
                messageType: 'Damage Billing Request',
                reference: contract?.contractNo || billId,
                targetSystem: 'SAP S/4HANA',
                status: 'Success',
                billingDocument,
                payload: JSON.stringify({ invoiceNo: billingDocument, billId, totalAmount: bill.totalAmount }),
                lastAttemptAt: new Date().toISOString()
            });
            return updateBill(billId, { billingStatus: 'Posted', invoiceNo: billingDocument });
        });

        // Workflow buttons on the selected bill (bound actions forward to the actions above)
        exposeBoundActions(this, 'RepairBills', {
            approve: ['approveRepairBill', 'billId', d => ({ approvalReason: d.reason })],
            adjust: ['adjustRepairBill', 'billId'],
            reject: ['rejectRepairBill', 'billId'],
            dispute: ['disputeRepairBill', 'billId'],
            post: ['postInvoice', 'billId']
        });

        hidePricesFromYardWorker(this);                                                     // FRD: no prices for yard workers
        await super.init();
    }
}
