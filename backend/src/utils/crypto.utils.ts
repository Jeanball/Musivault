/**
 * Encryption for secrets stored in the database (currently users' Discogs tokens).
 * AES-256-GCM with a key derived from the `ENCRYPTION_KEY` environment variable.
 * It is deliberately separate from `JWT_SECRET`: rotating that one must not
 * silently invalidate every stored token.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
// Fixed salt: the key only needs to be stretched from the env value, and
// a per-value salt would make the derived key differ from one token to the next.
const KEY_SALT = 'musivault-encryption-key';

let cachedKey: { source: string; key: Buffer } | null = null;

/** Whether `ENCRYPTION_KEY` is set, i.e. whether secrets can be stored. */
export function hasEncryptionKey(): boolean {
    return !!process.env.ENCRYPTION_KEY;
}

function getKey(): Buffer {
    const source = process.env.ENCRYPTION_KEY;
    if (!source) {
        throw new Error('ENCRYPTION_KEY not configured');
    }
    if (!cachedKey || cachedKey.source !== source) {
        cachedKey = { source, key: crypto.scryptSync(source, KEY_SALT, 32) };
    }
    return cachedKey.key;
}

/**
 * Encrypt a string into `iv:authTag:ciphertext` (base64 parts).
 * @throws Error if `ENCRYPTION_KEY` is not configured
 */
export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64')).join(':');
}

/**
 * Decrypt a value produced by `encryptSecret`.
 * @throws Error if the key is missing or changed, or the value was tampered with
 */
export function decryptSecret(payload: string): string {
    const [iv, authTag, encrypted] = payload.split(':').map(p => Buffer.from(p, 'base64'));
    if (!iv || !authTag || !encrypted) {
        throw new Error('Malformed encrypted value');
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
