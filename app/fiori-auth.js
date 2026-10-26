/**
 * SAP Fiori Enterprise Role-Based Access Control (RBAC) & Navigation Guard
 * Shared across all Fiori Elements applications in the Rental Equipment suite.
 */

const FIORI_ROLES_CONFIG = {
    'Admin': {
        title: 'System Administrator',
        color: '#0070f2',
        apps: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner'],
        act: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner']
    },
    'Dispatcher': {
        title: 'Rental Dispatcher & Coordinator',
        color: '#00838f',
        apps: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['customer-management', 'rentals', 'locations', 'fleet-overview'],
        act: ['rentals', 'fleet-overview', 'locations']
    },
    'YardWorker': {
        title: 'Senior Yard Inspector',
        color: '#107e3e',
        apps: ['fleet-overview', 'locations', 'inspections'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['inspections'],
        act: ['inspections', 'fleet-overview']
    },
    'BillingClerk': {
        title: 'Billing & Dispute Specialist',
        color: '#8e44ad',
        apps: ['customer-management', 'rentals', 'damage-charge-approval'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['damage-charge-approval'],
        act: ['damage-charge-approval']
    },
    'Technician': {
        title: 'Lead Workshop Technician',
        color: '#e67e22',
        apps: ['repair-jobs', 'maintenance-planner', 'fleet-overview', 'locations', 'inspections'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['repair-jobs', 'maintenance-planner'],
        act: ['repair-jobs', 'maintenance-planner']
    },
    'Manager': {
        title: 'Operations & Fleet Director',
        color: '#2980b9',
        apps: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner'],
        act: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner']
    },
    'Auditor': {
        title: 'Compliance & Quality Auditor (read-only)',
        color: '#d35400',
        apps: ['customer-management', 'rentals', 'locations', 'fleet-overview', 'inspections', 'damage-charge-approval', 'repair-jobs', 'maintenance-planner'],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: [],
        act: []
    },
    'None': {
        title: 'No role assigned - ask an admin to assign a sprint role collection',
        color: '#bb0000',
        apps: [],
        // apps where the role may create/edit/delete, and where it may run workflow actions
        edit: [],
        act: []
    }
};

// Check current user session
function getFioriSession() {
    try {
        const raw = localStorage.getItem('fiori_user_session');
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to read fiori_user_session', e);
    }
    return null;
}

function clearFioriSession() {
    localStorage.removeItem('fiori_user_session');
}

// The approuter enforces CSRF protection: every POST/PUT/PATCH/DELETE needs an X-CSRF-Token
// fetched from the approuter first. Locally (no approuter) no token is returned and none is needed.
let csrfToken = null;
async function fetchCsrfToken() {
    try {
        const res = await fetch('/rental/', { method: 'HEAD', headers: { 'X-CSRF-Token': 'Fetch' }, credentials: 'same-origin' });
        csrfToken = res.headers.get('X-CSRF-Token');
    } catch (e) {
        csrfToken = null;
    }
    return csrfToken;
}
async function csrfFetch(url, options = {}) {
    const send = () => fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { ...(options.headers || {}), ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }
    });
    if (!csrfToken) await fetchCsrfToken();
    let res = await send();
    if (res.status === 403 && (res.headers.get('X-CSRF-Token') || '').toLowerCase() === 'required') {
        await fetchCsrfToken();
        res = await send();
    }
    return res;
}

// Highest-privilege role wins when the XSUAA user holds several role collections
const FIORI_ROLE_PRIORITY = ['Admin', 'Manager', 'Dispatcher', 'BillingClerk', 'Technician', 'YardWorker', 'Auditor'];

/**
 * Real SAP login: behind the approuter the user is already authenticated by XSUAA.
 * Read the user and their scopes from the approuter user API and build the session from them.
 * Resolves to null when there is no approuter (e.g. local `cds watch`): the user is then not signed in.
 */
async function loadXsuaaSession() {
    try {
        const res = await fetch('/user-api/currentUser', { credentials: 'same-origin' });
        if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
        const user = await res.json();
        const granted = (user.scopes || []).map(s => s.split('.').pop());
        const role = FIORI_ROLE_PRIORITY.find(r => granted.includes(r)) || 'None';
        const roleCfg = FIORI_ROLES_CONFIG[role];
        const name = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.displayName || user.email || user.name;
        const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
        const session = {
            source: 'xsuaa',
            username: user.email || user.name,
            role: role,
            roles: granted.filter(r => FIORI_ROLES_CONFIG[r]),
            name: name,
            title: roleCfg.title,
            avatar: initials || '?',
            plant: 'PLANT-NGP (Nagpur Yard)',
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('fiori_user_session', JSON.stringify(session));
        return session;
    } catch (e) {
        return null;
    }
}

function isXsuaaSession(session) {
    return !!(session && session.source === 'xsuaa');
}

// In sub-apps: Guard access and render top Fiori navigation bar
function initSubAppGuard(currentAppId, currentAppTitle) {
    // Only a session built from the real SAP (XSUAA) user counts
    const stored = getFioriSession();
    const cached = isXsuaaSession(stored) ? stored : null;
    let session = cached;

    // Re-check the SAP user and reload when it differs from the cached session (new login, role change, logout)
    loadXsuaaSession().then(real => {
        if (!real) {
            if (stored) {
                clearFioriSession();
                if (cached) window.location.reload();
            }
            return;
        }
        if (!cached || real.role !== cached.role || real.username !== cached.username) {
            window.location.reload();
        }
    });

    // Not signed in with SAP: no app access
    if (!session) {
        session = { role: 'None', name: 'Not signed in', avatar: '?', plant: '-' };
    }

    const roleCfg = FIORI_ROLES_CONFIG[session.role];
    const isAllowed = roleCfg && (roleCfg.apps.includes(currentAppId) || session.role === 'Admin');

    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    injectShellStyles();

    if (!isAllowed) {
        // Access denied: same shell bar, then a centred message
        document.addEventListener('DOMContentLoaded', function () {
            document.body.innerHTML = '';
            document.body.prepend(buildShellBar(session, roleCfg, currentAppTitle, esc));
            const box = document.createElement('div');
            box.className = 'retclDenied';
            box.innerHTML = `
                <div class="retclDeniedCard">
                    <div class="retclDeniedIcon" aria-hidden="true">&#x1F512;</div>
                    <h2>Authorization required</h2>
                    <p>You are signed in as <strong>${esc(session.name)}</strong> (${esc(roleCfg ? roleCfg.title : session.role)}).
                       Your role does not include <strong>${esc(currentAppTitle || currentAppId)}</strong>.</p>
                    <p class="retclDeniedRoles">Roles with access: ${esc(getAllowedRolesForApp(currentAppId).join(', ') || 'none')}</p>
                    <a class="retclBtnEmph" href="/index.html">Back to launchpad</a>
                </div>`;
            document.body.appendChild(box);
        });
        return false;
    }

    // Read-only for this app: hide create/edit/delete and/or workflow buttons the backend would refuse
    const hide = [];
    if (!(roleCfg.edit || []).includes(currentAppId)) {
        hide.push('[id*="::StandardAction::Create"]', '[id*="::StandardAction::Edit"]', '[id*="::StandardAction::Delete"]',
            '[id*="::StandardAction::CreateFromMenu"]', '[id$="::Create"]', '[id$="::Delete"]');
    }
    if (!(roleCfg.act || []).includes(currentAppId)) {
        hide.push('[id*="::DataFieldForAction::"]');
    }
    if (hide.length) {
        const st = document.createElement('style');
        st.textContent = hide.join(',\n') + ' { display: none !important; }';
        document.head.appendChild(st);
    }

    // Shell bar matching the launchpad
    document.addEventListener('DOMContentLoaded', function () {
        const topBar = buildShellBar(session, roleCfg, currentAppTitle, esc);
        document.body.prepend(topBar);

        // Automatic draft discard mechanism for new unsaved records
        const APP_SERVICE_MAP = {
            'customer-management': '/rental/',
            'rentals': '/rental/',
            'locations': '/rental/',
            'fleet-overview': '/rental/',
            'inspections': '/inspection/',
            'damage-charge-approval': '/billing/',
            'repair-jobs': '/maintenance/',
            'maintenance-planner': '/maintenance/'
        };
        const currentServiceRoot = APP_SERVICE_MAP[currentAppId] || '/rental/';

        function getDraftPathFromHash(hash) {
            if (!hash || !hash.includes('IsActiveEntity=false')) return null;
            const cleanHash = hash.replace(/^[#/]+/, '').split('?')[0];
            const match = cleanHash.match(/([a-zA-Z0-9_]+)\(([^)]*IsActiveEntity=false[^)]*)\)/);
            if (match) {
                return `${match[1]}(${match[2]})`;
            }
            return null;
        }

        // Prefetch the CSRF token so the tab-close cleanup below can use it
        fetchCsrfToken();

        async function discardDraftUrl(draftPath) {
            if (!draftPath) return;
            try {
                const fullUrl = currentServiceRoot + draftPath;
                await csrfFetch(fullUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                console.warn('Draft cleanup notice:', err);
            }
        }

        function refreshUI5List() {
            try {
                if (window.sap && sap.ui && sap.ui.core) {
                    const compId = document.querySelector('[data-sap-ui-component]')?.getAttribute('data-id');
                    const comp = compId && sap.ui.core.Component.get(compId);
                    if (comp && comp.getModel()) {
                        comp.getModel().refresh();
                    }
                }
            } catch (e) {}
        }

        // 1. Discard draft when clicking "<- Launchpad"
        const launchpadLink = topBar.querySelector('a');
        if (launchpadLink) {
            launchpadLink.addEventListener('click', async function (e) {
                e.preventDefault();
                const currentDraft = getDraftPathFromHash(window.location.hash);
                if (currentDraft) {
                    await discardDraftUrl(currentDraft);
                }
                window.location.href = '/index.html';
            });
        }

        // 2. Discard draft if user navigates back to the List Report without saving/activating
        window.addEventListener('hashchange', async function (event) {
            const oldHash = event.oldURL ? event.oldURL.split('#')[1] || '' : '';
            const newHash = event.newURL ? event.newURL.split('#')[1] || '' : '';

            // If user was on a new draft and navigated away WITHOUT activating (active entity URL contains IsActiveEntity=true)
            if (oldHash.includes('IsActiveEntity=false') && !newHash.includes('IsActiveEntity=true')) {
                const draftPath = getDraftPathFromHash(oldHash);
                if (draftPath) {
                    await discardDraftUrl(draftPath);
                    setTimeout(refreshUI5List, 150);
                }
            }
        });

        // 3. Discard draft on browser tab close or refresh
        window.addEventListener('beforeunload', function () {
            const currentDraft = getDraftPathFromHash(window.location.hash);
            if (currentDraft) {
                // Page is closing: no time to fetch a token, so use the one prefetched on load
                fetch(currentServiceRoot + currentDraft, {
                    method: 'DELETE',
                    keepalive: true,
                    credentials: 'same-origin',
                    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
                }).catch(() => {});
            }
        });

        // Ensure clean flex layout so the bottom footer bar (Create / Save) is never pushed below the screen
        document.documentElement.style.height = '100%';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.documentElement.style.overflow = 'hidden';

        document.body.style.height = '100vh';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.display = 'flex';
        document.body.style.flexDirection = 'column';
        document.body.style.position = 'relative';
        document.body.style.top = '0';

        const comp = document.querySelector('[data-sap-ui-component]');
        if (comp) {
            comp.style.height = 'calc(100vh - var(--retclShellHeight, 3rem))';
            comp.style.flex = '1 1 auto';
            comp.style.position = 'relative';
            comp.style.overflow = 'hidden';
        }
    });

    return true;
}

// Shell bar shown above every Fiori app; mirrors the launchpad's sap.f.ShellBar and uses SAP theme
// parameters (CSS variables), so it follows the light/dark Horizon theme automatically.
function buildShellBar(session, roleCfg, appTitle, esc) {
    const bar = document.createElement('header');
    bar.id = 'fiori-subapp-topbar';
    bar.className = 'retclShell';
    const roleText = session.role === 'None' ? 'No role assigned' : (roleCfg ? roleCfg.title : session.role);
    bar.innerHTML = `
        <a class="retclShellBack" href="/index.html" title="Back to launchpad" aria-label="Back to launchpad">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10.5 2.5 5 8l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <span class="retclShellLogo" aria-hidden="true">RET</span>
        <div class="retclShellTitles">
            <span class="retclShellTitle">${esc(appTitle || 'Rental Equipment Tracking')}</span>
            <span class="retclShellSub">Rental Equipment Tracking</span>
        </div>
        <div class="retclShellSpacer"></div>
        <span class="retclShellRole${session.role === 'None' ? ' retclShellRoleNone' : ''}">${esc(roleText)}</span>
        <span class="retclShellAvatar" title="${esc(session.name)}${session.plant && session.plant !== '-' ? ' · ' + esc(session.plant) : ''}">${esc(session.avatar)}</span>`;
    return bar;
}

function injectShellStyles() {
    if (document.getElementById('retclShellStyles')) return;
    const st = document.createElement('style');
    st.id = 'retclShellStyles';
    st.textContent = `
        :root { --retclShellHeight: 3rem; }
        .retclShell {
            height: var(--retclShellHeight); flex-shrink: 0; box-sizing: border-box;
            display: flex; align-items: center; gap: 0.5rem; padding: 0 1rem;
            background: var(--sapShell_Background, #fff); color: var(--sapShell_TextColor, #1d2d3e);
            box-shadow: var(--sapContent_HeaderShadow, 0 0 0.125rem rgba(34,53,72,.15), inset 0 -0.0625rem 0 rgba(34,53,72,.2));
            font-family: var(--sapFontFamily, "72", "72full", Arial, Helvetica, sans-serif); font-size: var(--sapFontSize, .875rem);
            position: relative; z-index: 100;
        }
        .retclShellBack {
            display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem;
            border-radius: var(--sapButton_BorderCornerRadius, .5rem); color: var(--sapShell_InteractiveTextColor, var(--sapShell_TextColor, #1d2d3e));
            text-decoration: none;
        }
        .retclShellBack:hover { background: var(--sapShell_Hover_Background, var(--sapButton_Lite_Hover_Background, #eaecee)); }
        .retclShellBack:focus-visible { outline: var(--sapContent_FocusWidth, .125rem) solid var(--sapContent_FocusColor, #0070f2); }
        .retclShellLogo {
            background: var(--sapBrandColor, #0070f2); color: #fff; font-weight: 700; font-size: .8125rem; letter-spacing: .02em;
            padding: .3rem .55rem; border-radius: .375rem;
        }
        .retclShellTitles { display: flex; align-items: baseline; gap: .625rem; min-width: 0; margin-left: .25rem; }
        .retclShellTitle { font-family: var(--sapFontBoldFamily, "72-Bold", "72", Arial, sans-serif); font-weight: 700; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .retclShellSub { color: var(--sapContent_LabelColor, #556b82); font-size: .875rem; white-space: nowrap; }
        .retclShellSpacer { flex: 1; }
        .retclShellRole {
            background: var(--sapInformationBackgroundColor, #e1f4ff); color: var(--sapInformativeTextColor, #0064d9);
            border-radius: 1rem; padding: .2rem .65rem; font-size: .75rem; font-weight: 600; white-space: nowrap;
        }
        .retclShellRoleNone { background: var(--sapErrorBackgroundColor, #ffeaf4); color: var(--sapNegativeTextColor, #aa0808); }
        .retclShellAvatar {
            width: 2rem; height: 2rem; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
            background: var(--sapAccentColor6, #286eb4); color: var(--sapContent_ContrastTextColor, #fff); font-size: .75rem; font-weight: 700;
        }
        @media (max-width: 600px) { .retclShellSub, .retclShellRole { display: none; } }
        .retclDenied { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem;
            background: var(--sapBackgroundColor, #f5f6f7); font-family: var(--sapFontFamily, "72", Arial, sans-serif); min-height: calc(100vh - var(--retclShellHeight)); }
        .retclDeniedCard { background: var(--sapTile_Background, #fff); color: var(--sapTextColor, #1d2d3e); border-radius: 1rem;
            box-shadow: var(--sapContent_Shadow1, 0 0 .125rem rgba(34,53,72,.15)); padding: 2.5rem; max-width: 34rem; text-align: center; }
        .retclDeniedCard h2 { margin: .5rem 0; font-size: 1.375rem; }
        .retclDeniedCard p { color: var(--sapContent_LabelColor, #556b82); line-height: 1.5; }
        .retclDeniedIcon { font-size: 2.5rem; }
        .retclDeniedRoles { font-size: .8125rem; }
        .retclBtnEmph { display: inline-block; margin-top: 1rem; padding: .55rem 1.25rem; border-radius: .5rem; text-decoration: none; font-weight: 600;
            background: var(--sapButton_Emphasized_Background, #0070f2); color: var(--sapButton_Emphasized_TextColor, #fff); }
    `;
    document.head.appendChild(st);
}

function getAllowedRolesForApp(appId) {
    const allowed = [];
    for (const [role, cfg] of Object.entries(FIORI_ROLES_CONFIG)) {
        if (cfg.apps.includes(appId)) {
            allowed.push(role);
        }
    }
    return allowed;
}

// Export globals
window.FIORI_ROLES_CONFIG = FIORI_ROLES_CONFIG;
window.getFioriSession = getFioriSession;
window.clearFioriSession = clearFioriSession;
window.loadXsuaaSession = loadXsuaaSession;
window.isXsuaaSession = isXsuaaSession;
window.initSubAppGuard = initSubAppGuard;

/* ==========================================================================
   CLOUDINARY EVIDENCE CAPTURE & TAMPER-PROOF SHA-256 INTEGRATION (FR-009)
   ========================================================================== */

/**
 * Compute SHA-256 hash using browser Web Crypto API
 */
async function computeBrowserSha256(arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Open Photographic Evidence Capture & Cloudinary Upload Dialog
 */
window.openEvidencePhotoCaptureDialog = function(options = {}) {
    // Remove existing modal if any
    const existingModal = document.getElementById('sap-cloudinary-capture-modal');
    if (existingModal) existingModal.remove();

    // 1. Determine current entity and ID with robust extraction
    let entityId = options.entityId || options.conditionLog_ID || options.damage_ID || options.repairBill_ID;
    
    // Strategy A: Query active UI5 control binding context
    if (!entityId && window.sap && sap.ui && sap.ui.getCore) {
        try {
            const elements = document.querySelectorAll('.sapUxAPObjectPageLayout, [data-sap-ui-area], .sapMPage, .sapFDynamicPage');
            for (const el of elements) {
                if (el.id) {
                    const ctrl = sap.ui.getCore().byId(el.id);
                    if (ctrl && ctrl.getBindingContext) {
                        const ctx = ctrl.getBindingContext();
                        if (ctx && ctx.getProperty) {
                            const val = ctx.getProperty('ID');
                            if (val) {
                                entityId = val;
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {}
    }

    // Strategy B: Match any valid UUID in the URL hash or path (handles Drafts and Active entities)
    // Strategy B: Match any valid UUID in the URL hash or path (handles Drafts and Active entities)
    if (!entityId) {
        const fullUrl = decodeURIComponent(window.location.href || '');
        const uuidMatch = fullUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (uuidMatch && uuidMatch[1]) {
            entityId = uuidMatch[1];
        }
    }

    const currentUrl = decodeURIComponent(window.location.href);
    const isInspection = currentUrl.includes('inspection') || currentUrl.includes('ConditionLogs') || options.entityType === 'ConditionLogs';
    const isDamage = currentUrl.includes('DamageRecords') || options.entityType === 'DamageRecords';
    const isRepairBill = currentUrl.includes('RepairBills') || currentUrl.includes('damage-charge') || currentUrl.includes('damage charge') || currentUrl.includes('billing') || options.entityType === 'RepairBills';

    const defaultType = options.defaultPhotoType || (isRepairBill ? 'Settlement' : 'Return');
    const entityLabel = isInspection ? 'Inspection' : (isDamage ? 'Damage Incident' : (isRepairBill ? 'Repair Bill' : 'Record'));

    // Create modal DOM structure
    const modal = document.createElement('div');
    modal.id = 'sap-cloudinary-capture-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.45);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "72", "72full", Arial, Helvetica, sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 8px; width: 520px; max-width: 95vw; box-shadow: 0 10px 30px rgba(0,0,0,0.18); overflow: hidden; display: flex; flex-direction: column; border: 1px solid #d9d9d9; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            <!-- SAP Fiori Header -->
            <div style="background: #ffffff; border-bottom: 1px solid #e5e5e5; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: #1d2d3e;">Upload Photographic Evidence</div>
                    ${entityId ? `<div style="font-size: 12px; color: #556b82; margin-top: 2px;">Linked to ${entityLabel}: #${entityId.substring(0,8)}...</div>` : ''}
                </div>
                <button id="modal-close-btn" style="background: transparent; border: none; color: #556b82; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 4px; line-height: 1;" title="Close">✕</button>
            </div>

            <!-- Body -->
            <div style="padding: 20px; overflow-y: auto; max-height: 75vh; display: flex; flex-direction: column; gap: 16px;">
                <!-- Live Camera Viewfinder (Embedded HTML5 WebRTC Video) -->
                <div id="camera-viewfinder-box" style="display: none; background: #000; border-radius: 6px; overflow: hidden; position: relative;">
                    <video id="live-webcam-video" autoplay playsinline style="width: 100%; max-height: 300px; object-fit: cover; display: block;"></video>
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                        ● Live Camera
                    </div>
                    <!-- Viewfinder Action Bar -->
                    <div style="position: absolute; bottom: 12px; left: 0; width: 100%; display: flex; justify-content: center; gap: 10px; align-items: center;">
                        <button id="btn-snap-now" type="button" style="background: #0070f2; color: white; border: none; border-radius: 4px; padding: 8px 20px; font-weight: 600; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                            Capture Photo
                        </button>
                        <button id="btn-cancel-cam" type="button" style="background: rgba(0,0,0,0.6); color: white; border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; padding: 8px 14px; font-weight: 500; font-size: 12px; cursor: pointer;">
                            Cancel
                        </button>
                    </div>
                </div>

                <!-- Capture Source Selector -->
                <div id="source-selector-box">
                    <label style="font-size: 12px; font-weight: 600; color: #556b82; text-transform: uppercase; margin-bottom: 6px; display: block;">Select Image Source</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button id="btn-open-live-camera" type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: 1px solid #89919a; background: #ffffff; border-radius: 4px; cursor: pointer; color: #0070f2; font-weight: 600; font-size: 13px; transition: all 0.15s;">
                            Open Live Camera
                        </button>
                        <button id="btn-pick-file" type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: 1px solid #89919a; background: #ffffff; border-radius: 4px; cursor: pointer; color: #0070f2; font-weight: 600; font-size: 13px; transition: all 0.15s;">
                            Upload From Device
                        </button>
                    </div>
                    <!-- Hidden file inputs -->
                    <input id="regular-file-input" type="file" accept="image/*" style="display: none;">
                </div>

                <!-- Hidden canvas for camera snapshot processing -->
                <canvas id="snapshot-canvas" style="display: none;"></canvas>

                <!-- Evidence Type Select -->
                <div>
                    <label style="font-size: 12px; font-weight: 600; color: #556b82; text-transform: uppercase; margin-bottom: 6px; display: block;">Evidence Classification</label>
                    <select id="evidence-type-select" style="width: 100%; padding: 8px 12px; border: 1px solid #89919a; border-radius: 4px; font-size: 13px; background: #ffffff; color: #1d2d3e; outline: none;">
                        <option value="Return" ${defaultType === 'Return' ? 'selected' : ''}>Customer Return Inspection (Check-In)</option>
                        <option value="Dispatch" ${defaultType === 'Dispatch' ? 'selected' : ''}>Pre-Delivery Dispatch (Check-Out)</option>
                        <option value="Repair" ${defaultType === 'Repair' ? 'selected' : ''}>In-Shop Repair / Teardown Proof</option>
                        <option value="Settlement" ${defaultType === 'Settlement' ? 'selected' : ''}>Claim Settlement & Dispute Audit</option>
                        <option value="PreExisting" ${defaultType === 'PreExisting' ? 'selected' : ''}>Pre-Existing Baseline Damage</option>
                    </select>
                </div>

                <!-- Preview Area -->
                <div id="preview-container" style="display: none; border: 1px solid #d9d9d9; border-radius: 6px; padding: 12px; background: #f7f9fa;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <img id="preview-img" style="width: 72px; height: 72px; object-fit: cover; border-radius: 4px; border: 1px solid #d9d9d9;" />
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div id="preview-filename" style="font-weight: 600; font-size: 13px; color: #1d2d3e; word-break: break-all;">evidence.jpg</div>
                                <button id="btn-retake" type="button" style="background: #ffffff; border: 1px solid #89919a; color: #0070f2; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Retake</button>
                            </div>
                            <div id="preview-filesize" style="font-size: 12px; color: #6a737d; margin-top: 2px;">1.4 MB</div>
                            <div style="font-size: 11px; color: #107e3e; font-weight: 600; margin-top: 4px;">✓ SHA-256 Seal Computed</div>
                        </div>
                    </div>

                    <!-- Hash display -->
                    <div style="margin-top: 8px; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 4px; padding: 6px 10px;">
                        <div style="font-size: 10px; font-weight: 600; color: #6a737d; text-transform: uppercase;">Cryptographic Hash (SHA-256)</div>
                        <div id="preview-sha256" style="font-family: monospace; font-size: 11px; color: #1d2d3e; word-break: break-all; margin-top: 2px;">-</div>
                    </div>
                </div>

                <!-- Status / Progress Banner -->
                <div id="upload-status-box" style="display: none; padding: 10px 14px; border-radius: 4px; font-size: 12px; text-align: center;"></div>
            </div>

            <!-- SAP Fiori Footer -->
            <div style="background: #f7f9fa; border-top: 1px solid #e5e5e5; padding: 12px 20px; display: flex; justify-content: flex-end; gap: 8px;">
                <button id="btn-cancel" style="padding: 7px 16px; border: 1px solid #89919a; background: #ffffff; border-radius: 4px; font-size: 13px; cursor: pointer; font-weight: 600; color: #0070f2;">Cancel</button>
                <button id="btn-upload-cloudinary" disabled style="padding: 7px 22px; border: 1px solid #0070f2; background: #0070f2; color: #ffffff; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: not-allowed; opacity: 0.5; transition: all 0.2s;">Upload</button>
            </div>
        </div>
        <style>
            @keyframes modalPop {
                from { transform: scale(0.96); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        </style>
    `;

    document.body.appendChild(modal);

    // Modal elements
    const closeBtn = modal.querySelector('#modal-close-btn');
    const cancelBtn = modal.querySelector('#btn-cancel');
    const openLiveCamBtn = modal.querySelector('#btn-open-live-camera');
    const pickBtn = modal.querySelector('#btn-pick-file');
    const regularInput = modal.querySelector('#regular-file-input');
    const uploadBtn = modal.querySelector('#btn-upload-cloudinary');
    const previewContainer = modal.querySelector('#preview-container');
    const previewImg = modal.querySelector('#preview-img');
    const previewFilename = modal.querySelector('#preview-filename');
    const previewFilesize = modal.querySelector('#preview-filesize');
    const previewSha256 = modal.querySelector('#preview-sha256');
    const statusBox = modal.querySelector('#upload-status-box');
    const typeSelect = modal.querySelector('#evidence-type-select');
    const sourceSelectorBox = modal.querySelector('#source-selector-box');
    const cameraViewfinderBox = modal.querySelector('#camera-viewfinder-box');
    const videoElem = modal.querySelector('#live-webcam-video');
    const snapNowBtn = modal.querySelector('#btn-snap-now');
    const cancelCamBtn = modal.querySelector('#btn-cancel-cam');
    const canvasElem = modal.querySelector('#snapshot-canvas');
    const retakeBtn = modal.querySelector('#btn-retake');

    let currentImageData = null;
    let currentFileName = null;
    let currentSha256 = null;
    let currentLat = null;
    let currentLong = null;
    let liveMediaStream = null;

    // Fetch GPS coordinates in background
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                currentLat = pos.coords.latitude;
                currentLong = pos.coords.longitude;
            },
            () => { /* Geolocation optional */ }
        );
    }

    // Stop webcam tracks cleanly
    const stopLiveCamera = () => {
        if (liveMediaStream) {
            liveMediaStream.getTracks().forEach(t => t.stop());
            liveMediaStream = null;
        }
        if (videoElem) videoElem.srcObject = null;
        cameraViewfinderBox.style.display = 'none';
        sourceSelectorBox.style.display = 'block';
    };

    // Enhanced table & model refresh across SAP Fiori Elements
    // Reload only the photo list of the record on screen. Refreshing every binding / the whole model
    // re-reads value helps and unsaved drafts, which fails with "Not Found" on a new draft.
    const triggerRefresh = () => {
        try {
            if (!(window.sap && sap.ui && sap.ui.getCore)) return;
            const core = sap.ui.getCore();
            const pageEl = document.querySelector('.sapUxAPObjectPageLayout');
            const page = pageEl && core.byId(pageEl.id);
            const ctx = page && page.getBindingContext && page.getBindingContext();
            if (ctx && typeof ctx.requestSideEffects === 'function') {
                const p = ctx.requestSideEffects([{ $NavigationPropertyPath: 'photos' }]);
                if (p && p.catch) p.catch(() => {});
            }
        } catch (e) {}
    };

    // Close Modal
    const closeModal = () => {
        stopLiveCamera();
        modal.remove();
        triggerRefresh();
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    cancelCamBtn.addEventListener('click', stopLiveCamera);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Start Live Webcam Stream
    openLiveCamBtn.addEventListener('click', async () => {
        try {
            sourceSelectorBox.style.display = 'none';
            cameraViewfinderBox.style.display = 'block';

            liveMediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            videoElem.srcObject = liveMediaStream;
            await videoElem.play();
        } catch (camErr) {
            console.warn('[Camera] Could not access live webcam, falling back to file picker:', camErr);
            stopLiveCamera();
            alert('Could not access live camera feed (' + (camErr.message || 'permission denied') + '). Please select an image file instead.');
            regularInput.click();
        }
    });

    // Snap Photo From Live Camera Viewfinder
    snapNowBtn.addEventListener('click', () => {
        if (!videoElem.videoWidth || !videoElem.videoHeight) {
            alert('Camera feed is still initializing, please wait a moment...');
            return;
        }

        canvasElem.width = videoElem.videoWidth;
        canvasElem.height = videoElem.videoHeight;
        const ctx = canvasElem.getContext('2d');
        ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);

        stopLiveCamera();

        canvasElem.toBlob(async (blob) => {
            const fileName = `camera_${Date.now()}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            await handleFileSelected(file);
        }, 'image/jpeg', 0.92);
    });

    retakeBtn.addEventListener('click', () => {
        previewContainer.style.display = 'none';
        uploadBtn.disabled = true;
        uploadBtn.style.opacity = '0.5';
        uploadBtn.style.cursor = 'not-allowed';
        openLiveCamBtn.click();
    });

    pickBtn.addEventListener('click', () => regularInput.click());

    // Process selected or captured image file
    const handleFileSelected = async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }

        currentFileName = file.name || `capture_${Date.now()}.jpg`;
        previewFilename.textContent = currentFileName;
        previewFilesize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        // 1. Compute real SHA-256 via browser Web Crypto
        const arrayBuffer = await file.arrayBuffer();
        currentSha256 = await computeBrowserSha256(arrayBuffer);
        previewSha256.textContent = currentSha256;

        // 2. Read DataURL for preview & upload
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData = e.target.result;
            previewImg.src = currentImageData;
            previewContainer.style.display = 'block';

            // Enable upload button
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        };
        reader.readAsDataURL(file);
    };

    regularInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFileSelected(e.target.files[0]);
    });

    // Upload Evidence & Persist to Database
    uploadBtn.addEventListener('click', async () => {
        if (!currentImageData || !currentSha256) return;

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
        statusBox.style.display = 'block';
        statusBox.style.background = '#eaf2fd';
        statusBox.style.color = '#0040b0';
        statusBox.innerHTML = 'Uploading evidence...';

        try {
            const payload = {
                fileName: currentFileName,
                photoType: typeSelect.value,
                imageBase64: currentImageData,
                sha256: currentSha256,
                conditionLog_ID: isInspection ? entityId : (options.conditionLog_ID || null),
                damage_ID: isDamage ? entityId : (options.damage_ID || null),
                repairBill_ID: isRepairBill ? entityId : (options.repairBill_ID || null),
                latitude: currentLat,
                longitude: currentLong,
                uploadedBy: (window.getFioriSession && window.getFioriSession() && window.getFioriSession().name) || 'Yard Staff'
            };

            const response = await csrfFetch('/api/upload-evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const raw = await response.text();
            let result;
            try { result = JSON.parse(raw); } catch (e) { result = { error: raw || ('HTTP ' + response.status) }; }

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Server rejected photo upload');
            }

            statusBox.style.background = '#e6f6ec';
            statusBox.style.color = '#0d8234';
            statusBox.innerHTML = result.photo.mediaUrl
                ? `<strong>Upload Successful!</strong><br><a href="${result.photo.mediaUrl}" target="_blank" style="font-size:12px;color:#0070f2;word-break:break-all;">View Uploaded Photo ↗</a>`
                : `<strong>Evidence recorded.</strong><br><span style="font-size:12px;">SHA-256 hash saved. Image hosting (Cloudinary) is not configured, so no preview is stored.</span>`;
            uploadBtn.style.display = 'none';

            // Show Close button
            cancelBtn.textContent = 'Close';
            cancelBtn.style.background = '#0070f2';
            cancelBtn.style.color = '#ffffff';
            cancelBtn.style.borderColor = '#0070f2';

            // Trigger refresh immediately so table updates
            triggerRefresh();

            setTimeout(() => {
                closeModal();
                if (typeof options.onSuccess === 'function') {
                    try { options.onSuccess(result); } catch (e) {}
                }
                triggerRefresh();
            }, 1500);

        } catch (err) {
            console.error('[Upload Error]', err);
            statusBox.style.background = '#fde8e8';
            statusBox.style.color = '#c92a2a';
            statusBox.innerHTML = `<strong>Upload Failed:</strong> ${err.message}`;
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
    });
};

/**
 * Intelligent Observer: Automatically injects "📸 Capture / Upload Photo" button
 * onto tables for Photographic Evidence across all apps.
 */
function setupPhotoEvidenceTableObserver() {
    setInterval(() => {
        // Look for sections or table headers mentioning Photo Evidence or Photographic Evidence
        const sectionTitles = document.querySelectorAll('.sapUxAPObjectPageSubSectionHeaderTitle, .sapMTitle, .sapUxAPObjectPageSectionTitle');
        sectionTitles.forEach(titleElem => {
            const text = (titleElem.innerText || '').toLowerCase();
            if (text.includes('photographic evidence') || text.includes('photo evidence') || text.includes('evidence & hashes')) {
                const section = titleElem.closest('.sapUxAPObjectPageSubSection, .sapUxAPObjectPageSection, section, [role="region"]');
                if (!section) return;

                const toolbar = section.querySelector('.sapMTB, .sapMToolbar, .sapFDynamicPageTitle, .sapUiTableToolbar');
                if (!toolbar) return;

                // Remove separate custom button so only standard Create button remains
                const extraBtns = toolbar.querySelectorAll('.btn-cloudinary-capture-injected, .btn-cloudinary-fallback-create');
                extraBtns.forEach(b => b.remove());

                // Find the standard Create button on this table and hook it
                const buttons = toolbar.querySelectorAll('button, .sapMBtn');
                buttons.forEach(btn => {
                    const btnText = (btn.innerText || btn.textContent || '').trim();
                    const btnId = (btn.id || '').toLowerCase();
                    const isCreate = btnText === 'Create' || btnId.includes('create') || btnId.includes('standardaction::create');

                    if (isCreate && !btn.dataset.cloudinaryCreateHooked) {
                        btn.dataset.cloudinaryCreateHooked = 'true';
                        // Keep text and visual styling 100% normal standard Fiori Elements

                        // Intercept click in capture phase to launch Cloudinary capture modal
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();

                            let parentId = null;
                            const table = section.querySelector('.sapMList, .sapMTable, .sapUiTable');
                            if (table && table.id && window.sap && sap.ui && sap.ui.getCore) {
                                const ui5Ctrl = sap.ui.getCore().byId(table.id);
                                if (ui5Ctrl && ui5Ctrl.getBindingContext) {
                                    const ctx = ui5Ctrl.getBindingContext();
                                    if (ctx && ctx.getProperty) {
                                        parentId = ctx.getProperty('ID');
                                    }
                                }
                            }

                            // Robust entity type detection
                            const fullUrl = decodeURIComponent(window.location.href);
                            let detectedType = null;
                            if (fullUrl.includes('RepairBills') || fullUrl.includes('damage-charge') || fullUrl.includes('damage charge') || fullUrl.includes('billing')) {
                                detectedType = 'RepairBills';
                            } else if (fullUrl.includes('ConditionLogs') || fullUrl.includes('inspection')) {
                                detectedType = 'ConditionLogs';
                            } else if (fullUrl.includes('DamageRecords')) {
                                detectedType = 'DamageRecords';
                            }

                            window.openEvidencePhotoCaptureDialog({
                                entityId: parentId,
                                entityType: detectedType,
                                repairBill_ID: detectedType === 'RepairBills' ? parentId : null,
                                conditionLog_ID: detectedType === 'ConditionLogs' ? parentId : null,
                                damage_ID: detectedType === 'DamageRecords' ? parentId : null
                            });
                        }, true);
                    }
                });
            }
        });

        // Enhance image thumbnails with click-to-expand Lightbox
        const photoImgs = document.querySelectorAll('.sapMImg, .sapMAvatar, img');
        photoImgs.forEach(img => {
            const src = img.src || img.getAttribute('src') || '';
            if ((src.includes('cloudinary') || src.startsWith('data:image/')) && !img.dataset.lightboxBound) {
                img.dataset.lightboxBound = 'true';
                img.style.cursor = 'zoom-in';
                img.title = 'Click to view full-resolution evidence photo';
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openImageLightbox(src);
                });
            }
        });
    }, 1500);
}

/**
 * High-Resolution Photo Lightbox Modal
 */
function openImageLightbox(imageUrl) {
    const existing = document.getElementById('sap-photo-lightbox-modal');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.id = 'sap-photo-lightbox-modal';
    box.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.88);
        z-index: 100000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(6px);
    `;

    box.innerHTML = `
        <div style="position: absolute; top: 16px; right: 24px; display: flex; gap: 12px; z-index: 2;">
            <a href="${imageUrl}" target="_blank" download="evidence.jpg" style="background: rgba(255,255,255,0.2); color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px;">⬇️ Download</a>
            <button id="lightbox-close" style="background: rgba(255,255,255,0.25); border: none; color: white; padding: 8px 16px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer;">✕ Close</button>
        </div>
        <div style="max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; align-items: center;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);" />
            <div style="margin-top: 12px; color: #a0c4ff; font-size: 12px; font-family: monospace; background: rgba(0,0,0,0.4); padding: 6px 14px; border-radius: 6px;">
                ☁️ Cloudinary Verified Evidence Photo
            </div>
        </div>
    `;

    box.querySelector('#lightbox-close').addEventListener('click', () => box.remove());
    box.addEventListener('click', (e) => {
        if (e.target === box) box.remove();
    });

    document.body.appendChild(box);
}

// Start observer
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPhotoEvidenceTableObserver);
} else {
    setupPhotoEvidenceTableObserver();
}

