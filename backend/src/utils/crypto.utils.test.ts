import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hasEncryptionKey } from './crypto.utils';

describe('crypto.utils', () => {
    const original = process.env.ENCRYPTION_KEY;

    beforeEach(() => {
        process.env.ENCRYPTION_KEY = 'test-key-one';
    });

    afterEach(() => {
        if (original === undefined) delete process.env.ENCRYPTION_KEY;
        else process.env.ENCRYPTION_KEY = original;
    });

    describe('hasEncryptionKey', () => {
        it('is true when ENCRYPTION_KEY is set', () => {
            expect(hasEncryptionKey()).toBe(true);
        });

        it('is false when ENCRYPTION_KEY is unset or empty', () => {
            delete process.env.ENCRYPTION_KEY;
            expect(hasEncryptionKey()).toBe(false);
            process.env.ENCRYPTION_KEY = '';
            expect(hasEncryptionKey()).toBe(false);
        });
    });

    describe('encryptSecret / decryptSecret', () => {
        it('round-trips a token', () => {
            expect(decryptSecret(encryptSecret('AbCdEf123456'))).toBe('AbCdEf123456');
        });

        it('round-trips an empty string and non-ASCII text', () => {
            expect(decryptSecret(encryptSecret(''))).toBe('');
            expect(decryptSecret(encryptSecret('pässwörd ✓'))).toBe('pässwörd ✓');
        });

        it('stores iv:authTag:ciphertext and never the plaintext', () => {
            const payload = encryptSecret('my-secret-token');
            expect(payload.split(':')).toHaveLength(3);
            expect(payload).not.toContain('my-secret-token');
        });

        it('uses a fresh IV, so the same input encrypts differently each time', () => {
            expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
        });

        it('throws on both sides when ENCRYPTION_KEY is not configured', () => {
            const payload = encryptSecret('x');
            delete process.env.ENCRYPTION_KEY;
            expect(() => encryptSecret('x')).toThrow('ENCRYPTION_KEY not configured');
            expect(() => decryptSecret(payload)).toThrow('ENCRYPTION_KEY not configured');
        });

        it('cannot decrypt after the key changed', () => {
            const payload = encryptSecret('x');
            process.env.ENCRYPTION_KEY = 'test-key-two';
            expect(() => decryptSecret(payload)).toThrow();
        });

        it('picks up a new key on the next call and decrypts again with the old one', () => {
            const payload = encryptSecret('x');
            process.env.ENCRYPTION_KEY = 'test-key-two';
            encryptSecret('y');
            process.env.ENCRYPTION_KEY = 'test-key-one';
            expect(decryptSecret(payload)).toBe('x');
        });

        it('rejects a tampered ciphertext', () => {
            const [iv, tag, data] = encryptSecret('hello world').split(':');
            const flipped = Buffer.from(data, 'base64');
            flipped[0] ^= 0xff;
            expect(() => decryptSecret([iv, tag, flipped.toString('base64')].join(':'))).toThrow();
        });

        it('rejects a malformed value', () => {
            expect(() => decryptSecret('')).toThrow('Malformed encrypted value');
            expect(() => decryptSecret('only-one-part')).toThrow('Malformed encrypted value');
        });
    });
});
