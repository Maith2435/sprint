import 'dotenv/config';                                                         // loads .env locally (no-op on BTP)
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';

/**
 * Photo evidence storage (FR-018/019, FRD "Evidence Integrity").
 * Images go to Cloudinary (stand-in for BTP Object Store, which a trial account doesn't have).
 * Credentials come from the environment: either CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>
 * (read by the SDK automatically) or CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET.
 */
cloudinary.config({
    secure: true,                                                               // always return https URLs
    ...(process.env.CLOUDINARY_CLOUD_NAME && {                                  // separate variables, if used
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    })
});
const { cloud_name, api_key, api_secret } = cloudinary.config();
const isConfigured = Boolean(cloud_name && api_key && api_secret);
console.log(isConfigured ? `[Cloudinary] Using account ${cloud_name}` : '[Cloudinary] Not configured: only SHA-256 hashes will be stored');

/**
 * Stores an evidence photo and returns its URL plus a SHA-256 fingerprint.
 * The hash proves later that the image was not altered (tamper-proof evidence).
 *
 * @param {string} imageBase64  data URI ("data:image/jpeg;base64,...") or plain base64
 * @param {string} fileName     original file name
 * @returns {{ mediaUrl: string|null, publicId: string|null, sha256: string }}
 */
export async function uploadEvidencePhoto(imageBase64, fileName) {
    const [, mimeType = 'image/jpeg', data = imageBase64] = imageBase64.match(/^data:([^;]+);base64,(.+)$/) || []; // split data URI
    const buffer = Buffer.from(data, 'base64');                                 // raw image bytes
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');    // tamper-proof fingerprint
    if (isConfigured) {
        try {
            const result = await cloudinary.uploader.upload(`data:${mimeType};base64,${data}`, {
                folder: 'rental_damage_evidence',
                context: { sha256, original_filename: fileName }                  // hash travels with the image
            });
            return { mediaUrl: result.secure_url, publicId: result.public_id, sha256 };
        } catch (err) {
            console.error('[Cloudinary] Upload failed, keeping the hash only:', err.message);
        }
    }
    // Not configured or upload failed: keep the evidence hash; the image URL column can't hold a full image
    return { mediaUrl: null, publicId: null, sha256 };
}
