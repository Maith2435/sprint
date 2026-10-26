/**
 * Build step (called from mta.yaml): copies the UI (app/) into gen/srv/app.
 * The CAP server serves that folder as static files, so in production the launchpad and the
 * Fiori apps come from the same server and URL as the OData services - exactly like `cds watch` locally.
 * The .cds annotation files are not copied: they are already compiled into the service model.
 */
import fs from 'node:fs';

fs.rmSync('gen/srv/app', { recursive: true, force: true });                          // start clean
fs.cpSync('app', 'gen/srv/app', { recursive: true, filter: file => !file.endsWith('.cds') });
console.log('[copy-ui] copied app/ -> gen/srv/app');
