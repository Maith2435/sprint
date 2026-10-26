/**
 * Who is signed in, and safe write requests.
 *
 * Login itself is done by SAP: the approuter sends every visitor through the XSUAA login page.
 * Here we only ask the approuter who the user is (/user-api/currentUser) and which roles
 * (scopes) their role collections give them.
 */
(function () {
    let sessionPromise = null;                                            // the user is looked up once per page

    /**
     * Resolves to { name, email, initials, role, plant } or null when there is no approuter
     * (for example when the backend is opened directly).
     */
    window.loadSession = function () {
        sessionPromise ??= fetch('/user-api/currentUser', { credentials: 'same-origin' })
            .then(res => res.ok && (res.headers.get('content-type') || '').includes('json') ? res.json() : null)
            .then(user => {
                if (!user) return null;
                const granted = (user.scopes || []).map(s => s.split('.').pop());       // 'sprint-...!t1.Admin' -> 'Admin'
                const role = window.RETCL.rolePriority.find(r => granted.includes(r)) || 'None';
                const name = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email || user.name;
                const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
                return { name, email: user.email || user.name, initials: initials || '?', role, plant: 'PLANT-NGP (Nagpur Yard)' };
            })
            .catch(() => null);
        return sessionPromise;
    };

    // CSRF protection: the approuter only accepts POST/PATCH/DELETE with an X-CSRF-Token
    // obtained from it first. Locally (no approuter) no token is needed.
    let csrfToken = null;
    async function fetchCsrfToken() {
        const res = await fetch('/rental/', { method: 'HEAD', headers: { 'X-CSRF-Token': 'Fetch' }, credentials: 'same-origin' });
        csrfToken = res.headers.get('X-CSRF-Token');
    }

    /** fetch() that adds the CSRF token, and fetches a fresh one if the old token expired. */
    window.csrfFetch = async function (url, options = {}) {
        const send = () => fetch(url, {
            credentials: 'same-origin', ...options,
            headers: { ...options.headers, ...(csrfToken && { 'X-CSRF-Token': csrfToken }) }
        });
        if (!csrfToken) await fetchCsrfToken();
        let res = await send();
        if (res.status === 403 && /required/i.test(res.headers.get('X-CSRF-Token') || '')) { // token expired
            await fetchCsrfToken();
            res = await send();
        }
        return res;
    };
})();
