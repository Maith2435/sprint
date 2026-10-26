// Local stand-in for the SAP app router. Change role: http://localhost:4800/dev/role/<Role>
import http from 'node:http';
let role = 'Admin';
http.createServer((req, res) => {
  const m = req.url.match(/^\/dev\/role\/(\w+)/);
  if (m) { role = m[1]; res.writeHead(302, { Location: '/index.html' }); return res.end(); }
  if (req.url.startsWith('/user-api/currentUser')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ firstname: 'Test', lastname: role, email: role + '@example.com',
      scopes: role === 'noroles' ? [] : ['sprint!t1.' + role] }));
  }
  if (req.url.startsWith('/do/logout')) { res.end('logged out'); return; }
  const p = http.request({ host: 'localhost', port: 4004, path: req.url, method: req.method,
    headers: { ...req.headers, host: 'localhost:4004' } },
    r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(p);
}).listen(4800, () => console.log('Open http://localhost:4800'));