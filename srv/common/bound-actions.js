/**
 * Exposes existing service-level workflow actions as bound actions on an entity,
 * so Fiori Elements can offer them as buttons on the selected record.
 * The bound action forwards to the unbound one, which keeps the business logic
 * and its role checks (@requires) in one place.
 *
 * map: { boundAction: [unboundAction, keyParamName, (data, key) => extraParams] }
 */
export function exposeBoundActions(srv, entity, map) {
    for (const [bound, [unbound, keyParam, toParams]] of Object.entries(map)) {
        srv.on(bound, entity, async (req) => {
            const key = req.params[0];
            const id = key && typeof key === 'object' ? key.ID : key;
            const extra = toParams ? await toParams(req.data, id) : req.data;
            return srv.send(unbound, { [keyParam]: id, ...extra });
        });
    }
}
