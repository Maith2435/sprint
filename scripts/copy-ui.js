// Copies the UI (app/) into gen/srv/app so the CAP server serves the
// launchpad (index.html, Component.js, fiori-auth.js, manifests) in production,
// the same way `cds watch` serves app/ locally.
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('app');
const dest = path.resolve('gen/srv/app');
const skipDirs = new Set(['node_modules', 'dist', '.deploy']);
const skipFiles = /\.cds$|^package(-lock)?\.json$|^ui5.*\.yaml$|^xs-app\.json$/;

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
        const name = path.basename(p);
        return fs.statSync(p).isDirectory() ? !skipDirs.has(name) : !skipFiles.test(name);
    }
});
console.log(`[copy-ui] copied ${src} -> ${dest}`);
