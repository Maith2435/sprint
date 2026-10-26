/**
 * Photo evidence (FR-018/019): upload damage photos with a tamper-proof SHA-256 hash.
 *
 * On an inspection or repair bill in edit mode, the "Create" button of the photo table opens
 * this upload dialog instead of an empty row. The photo is sent to /api/upload-evidence
 * (srv/server.js), which stores it in Cloudinary and attaches it to the record.
 * Clicking a stored photo shows it full size.
 */
(function () {
    // Pages with a photo table, and the field that links a photo to that page's record
    const PHOTO_PAGES = { ConditionLogs: 'conditionLog_ID', RepairBills: 'repairBill_ID' };
    // Evidence types (same values as type EvidenceType in db/schema.cds)
    const TYPES = { Return: 'Return from Rent Photo', Dispatch: 'Dispatch / Pre-Rental Photo', DamageEvidence: 'Damage Incident Evidence', PostRepair: 'Post-Repair Verification' };

    // 1. Catch clicks on the photo table's Create button (capture phase: before UI5 handles it)
    document.addEventListener('click', (event) => {
        if (!event.target.closest('[id$="::table::photos::LineItem::StandardAction::Create"]')) return;
        event.preventDefault();
        event.stopImmediatePropagation();                                     // don't add an empty row
        const record = recordInUrl();
        if (record) openUploadDialog(record);
    }, true);

    // 2. Clicking a stored photo opens it full size
    document.addEventListener('click', (event) => {
        const img = event.target.closest('img[src*="res.cloudinary.com"]');
        if (!img) return;
        const overlay = document.createElement('div');
        overlay.className = 'retclLightbox';
        overlay.innerHTML = `<img src="${img.src}" alt="Evidence photo">`;
        overlay.onclick = () => overlay.remove();                              // click anywhere to close
        document.body.appendChild(overlay);
    });

    /** Which record is open, read from the page URL, e.g. #/ConditionLogs(ID=...,IsActiveEntity=false) */
    function recordInUrl() {
        const match = location.hash.match(/(ConditionLogs|RepairBills)\(ID=([0-9a-f-]{36})/i);
        return match && { field: PHOTO_PAGES[match[1]], id: match[2], isInspection: match[1] === 'ConditionLogs' };
    }

    /** SHA-256 of the file bytes, as hex text (computed in the browser so the user sees it before upload). */
    async function sha256Hex(arrayBuffer) {
        const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /** Best-effort GPS position of the photo (resolves to null if unavailable or refused). */
    function currentPosition() {
        return new Promise(resolve => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => resolve(null), { timeout: 5000 });
        });
    }

    /** Asks the open record to reload its photo list (SAP's "side effects" mechanism). */
    function refreshPhotoList() {
        const page = document.querySelector('.sapUxAPObjectPageLayout');
        const context = page && sap.ui.getCore().byId(page.id)?.getBindingContext();
        context?.requestSideEffects([{ $NavigationPropertyPath: 'photos' }]).catch(() => {});
    }

    function openUploadDialog(record) {
        const dialog = document.createElement('div');
        dialog.className = 'retclDialogBackdrop';
        dialog.innerHTML = `
            <div class="retclDialog" role="dialog" aria-label="Upload photographic evidence">
                <h3>Upload Photographic Evidence</h3>
                <label>Photo <input type="file" accept="image/*" capture="environment"></label>
                <label>Evidence type
                    <select>${Object.entries(TYPES).map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
                </label>
                <img class="retclPreview" alt="" hidden>
                <p class="retclHash"></p>
                <p class="retclStatus"></p>
                <div class="retclDialogButtons">
                    <button class="retclBtnEmph" data-upload disabled>Upload</button>
                    <button data-cancel>Cancel</button>
                </div>
            </div>`;
        document.body.appendChild(dialog);

        const $ = selector => dialog.querySelector(selector);
        $('select').value = record.isInspection ? 'Return' : 'DamageEvidence';   // sensible default
        $('[data-cancel]').onclick = () => dialog.remove();
        let photo = null;                                                       // { fileName, dataUrl, coords }

        // A file was chosen (or a picture taken): show it and its hash
        $('input[type=file]').onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const dataUrl = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
            $('.retclPreview').src = dataUrl;
            $('.retclPreview').hidden = false;
            $('.retclHash').textContent = 'SHA-256: ' + await sha256Hex(await file.arrayBuffer());
            photo = { fileName: file.name, dataUrl, coords: await currentPosition() };
            $('[data-upload]').disabled = false;
        };

        // Upload: send to the backend, then reload the photo list
        $('[data-upload]').onclick = async () => {
            $('[data-upload]').disabled = true;
            $('.retclStatus').textContent = 'Uploading...';
            const session = await window.loadSession();
            const res = await window.csrfFetch('/api/upload-evidence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [record.field]: record.id,
                    fileName: photo.fileName,
                    photoType: $('select').value,
                    imageBase64: photo.dataUrl,
                    latitude: photo.coords?.latitude,
                    longitude: photo.coords?.longitude,
                    uploadedBy: session?.name
                })
            });
            if (!res.ok) {
                $('.retclStatus').textContent = 'Upload failed: ' + ((await res.text()) || res.status);
                $('[data-upload]').disabled = false;
                return;
            }
            const { photo: saved } = await res.json();
            $('.retclStatus').textContent = saved.mediaUrl ? 'Uploaded.' : 'Evidence hash saved (image hosting is not configured).';
            refreshPhotoList();
            setTimeout(() => dialog.remove(), 1200);
        };
    }
})();
