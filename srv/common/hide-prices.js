/**
 * FRD Security & Authorization: "price data hidden from YardWorker".
 * Strips money fields from every READ result (including expanded children)
 * when the user's only business role is YardWorker.
 */
const PRICE_FIELDS = new Set([
    'rentalRatePerDay', 'dailyRentalRate', 'totalRentalAmount',
    'repairEstimate', 'cost', 'actualCost',
    'partsCost', 'labourCost', 'paintingCost', 'repairAmount', 'taxAmount', 'totalAmount',
    'baseCharge', 'labourRate', 'partsCharge', 'paintingCharge', 'autoApproveLimit'
]);
const PRICE_ROLES = ['Admin', 'Manager', 'Dispatcher', 'Technician', 'BillingClerk', 'Auditor'];

function strip(value) {
    if (Array.isArray(value)) return value.forEach(strip);
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
        if (PRICE_FIELDS.has(key)) delete value[key];
        else if (value[key] && typeof value[key] === 'object') strip(value[key]);
    }
}

export function hidePricesFromYardWorker(srv) {
    srv.after('READ', '*', (result, req) => {
        const user = req.user;
        if (!user || !user.is('YardWorker') || PRICE_ROLES.some(r => user.is(r))) return;
        strip(result);
    });
}
