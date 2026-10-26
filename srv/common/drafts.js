import cds from '@sap/cds';

const { DELETE } = cds.ql;

/**
 * When a list is opened, deletes drafts the user started but never filled in
 * (e.g. clicked "Create" and left), so they don't clutter the list.
 *
 * @param {object} srv        the CAP service
 * @param {string} entity     entity name inside the service, e.g. 'Customers'
 * @param {string} emptyWhere CQL condition that identifies an empty draft
 */
export function removeEmptyDraftsOnList(srv, entity, emptyWhere) {
    srv.before('READ', entity, async (req) => {
        const isList = !req.params?.length && !req.query.SELECT.one;            // only for list requests, not single records
        if (isList) await DELETE.from(`${srv.name}.${entity}.drafts`).where(emptyWhere); // drop empty drafts
    });
}
