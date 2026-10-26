import cds from '@sap/cds';

const { SELECT } = cds.ql;

/**
 * Returns the next running number for a document field, e.g. RENT-10001 -> RENT-10002.
 * Looks at saved records and open drafts so two drafts never get the same number.
 *
 * @param {string[]} tables  entities to scan (active table and, if any, its drafts)
 * @param {string}   column  field holding the number, e.g. 'contractNo'
 * @param {string}   prefix  text before the digits, e.g. 'RENT-'
 * @param {number}   start   number to continue from when nothing exists yet
 * @param {number}   [step]  increment (default 1)
 */
export async function nextNumber(tables, column, prefix, start, step = 1) {
    let highest = start;                                                       // highest number seen so far
    for (const table of tables) {
        const rows = await SELECT.from(table).columns(column);                  // all existing values of the column
        for (const row of rows) {
            const value = String(row[column] || '');                            // e.g. 'RENT-10005'
            if (!value.startsWith(prefix)) continue;                            // ignore other formats
            const number = parseInt(value.slice(prefix.length), 10);            // digits after the prefix
            if (number > highest) highest = number;                             // keep the maximum
        }
    }
    return prefix + (highest + step);                                          // e.g. 'RENT-10006'
}
