/**
 * Local stand-in for the SAP approuter (for testing on your PC only; not deployed).
 *
 * On BTP the approuter logs users in via XSUAA and tells the UI who they are (/user-api/currentUser).
 * Locally there is no approuter, so this tiny server pretends to be one:
 *   - answers /user-api/currentUser with a test user that has the chosen role
 *   - forwards everything else to the local CAP server (cds watch on port 4004)
 *
 * Usage:  npm run watch   (terminal 1)   +   npm run dev-router   (terminal 2)
 *         open http://localhost:4800, switch role with http://localhost:4800/dev/role/<Role>
 *         (Admin, Manager, Dispatcher, YardWorker, Technician, BillingClerk, Auditor, noroles)
 * Note: locally the backend uses "dummy" auth, so only the screens change per role, not the backend checks.
 */
import http from 'node:http';

let role = 'Admin';                                                                 // current test role

http.createServer((req, res) => {
    const switchRole = req.url.match(/^\/dev\/role\/(\w+)/);                        // /dev/role/<Role>
    if (switchRole) {
        role = switchRole[1];
        res.writeHead(302, { Location: '/index.html' });
        return res.end();
    }
    if (req.url.startsWith('/user-api/currentUser')) {                              // "who am I?"
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            firstname: 'Test', lastname: role, email: role.toLowerCase() + '@example.com',
            scopes: role === 'noroles' ? [] : ['sprint!t1.' + role]                  // same format as XSUAA scopes
        }));
    }
    if (req.url.startsWith('/do/logout')) return res.end('logged out');

    // Everything else goes to the CAP server
    const forward = http.request(
        { host: 'localhost', port: 4004, path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:4004' } },
        backend => { res.writeHead(backend.statusCode, backend.headers); backend.pipe(res); }
    );
    req.pipe(forward);
}).listen(4800, () => console.log('Open http://localhost:4800'));
