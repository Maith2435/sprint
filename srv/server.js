import cds from '@sap/cds';
import express from 'express';
import path from 'node:path';
import { uploadEvidencePhoto } from './common/cloudinary.js';

// Records a photo can belong to: the request names one of these fields (e.g. conditionLog_ID)
const PHOTO_PARENTS = [
    { field: 'conditionLog_ID', drafts: 'InspectionService.ConditionLogs.drafts', photos: 'InspectionService.DamagePhotos' },
    { field: 'damage_ID', drafts: 'InspectionService.DamageRecords.drafts', photos: 'InspectionService.DamagePhotos' },
    { field: 'repairBill_ID', drafts: 'BillingService.RepairBills.drafts', photos: 'BillingService.DamagePhotos' }
];
const UPLOAD_ROLES = ['YardWorker', 'Technician', 'BillingClerk', 'Manager', 'Admin']; // roles that may add evidence

/**
 * Saves the photo record next to its parent. If the parent is being edited (a draft),
 * the photo goes into the draft so it is saved together with the parent; otherwise it is saved directly.
 */
async function savePhoto(photo) {
    for (const parent of PHOTO_PARENTS) {
        const parentId = photo[parent.field];
        if (!parentId) continue;
        const draft = await SELECT.one.from(parent.drafts).where({ ID: parentId });   // is the parent in edit mode?
        if (draft) {
            return INSERT.into(cds.model.definitions[parent.photos].drafts).entries({
                ...photo, IsActiveEntity: false, HasActiveEntity: false, HasDraftEntity: false,
                DraftAdministrativeData_DraftUUID: draft.DraftAdministrativeData_DraftUUID
            });
        }
    }
    return INSERT.into('RentalEquipmentTrackingApp.DamagePhotos').entries(photo);   // parent not in edit mode
}

// Custom routes added before CAP serves the OData services
cds.on('bootstrap', (app) => {
    // All 8 Fiori apps share one Component.js (it picks the app from ?app=...)
    app.get('/:app/webapp/Component.js', (req, res) => res.sendFile(path.resolve('app/shared/Component.js')));

    // Photos are sent as base64 text, so allow large request bodies
    app.use(express.json({ limit: '50mb' }));

    // Photo evidence upload: hash + store the image, then attach it to the inspection, damage or bill
    app.post('/api/upload-evidence', cds.middlewares.before, async (req, res) => {
        const user = cds.context.user;                                              // set by CAP's auth middleware
        if (!UPLOAD_ROLES.some(role => user.is(role))) return res.status(403).json({ error: 'Forbidden' });
        const body = req.body;
        if (!body.imageBase64) return res.status(400).json({ error: 'Missing imageBase64 data in upload payload' });
        try {
            const fileName = body.fileName || `evidence_${Date.now()}.jpg`;
            const stored = await uploadEvidencePhoto(body.imageBase64, fileName);    // URL + SHA-256
            const photo = {
                ID: cds.utils.uuid(),
                conditionLog_ID: body.conditionLog_ID || null,
                damage_ID: body.damage_ID || null,
                repairBill_ID: body.repairBill_ID || null,
                fileName,
                photoType: body.photoType || 'Return',
                mediaType: 'image/jpeg',
                ...stored,
                latitude: body.latitude ? Number(body.latitude) : null,
                longitude: body.longitude ? Number(body.longitude) : null,
                uploadedAt: new Date().toISOString(),
                uploadedBy: body.uploadedBy || user.id
            };
            await savePhoto(photo);
            res.json({ success: true, photo });
        } catch (err) {
            console.error('[upload-evidence]', err);
            res.status(500).json({ error: err.message });
        }
    });
});

export default cds.server;
