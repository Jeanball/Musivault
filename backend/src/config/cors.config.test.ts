import { describe, expect, it } from 'vitest';
import { allowsLocalNetworkOrigins, getCorsOrigins, isLocalNetworkOrigin } from './cors.config';

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe('getCorsOrigins', () => {
    it('accepts any origin for CORS_ORIGINS=*', () => {
        expect(getCorsOrigins(env({ CORS_ORIGINS: '*' }))).toBe(true);
        expect(getCorsOrigins(env({ CORS_ORIGINS: '*', NODE_ENV: 'production' }))).toBe(true);
    });

    it('accepts any origin in production without CORS_ORIGINS', () => {
        expect(getCorsOrigins(env({ NODE_ENV: 'production' }))).toBe(true);
    });

    it('uses the explicit list, trimmed, in production and in development', () => {
        const list = ' https://a.example.com , https://b.example.com';
        expect(getCorsOrigins(env({ NODE_ENV: 'production', CORS_ORIGINS: list }))).toEqual(['https://a.example.com', 'https://b.example.com']);
        expect(getCorsOrigins(env({ NODE_ENV: 'development', CORS_ORIGINS: list }))).toEqual(['https://a.example.com', 'https://b.example.com']);
    });

    it('falls back to the Vite and Docker dev ports on localhost in development', () => {
        expect(getCorsOrigins(env({ NODE_ENV: 'development' }))).toEqual(['http://localhost:5173', 'http://localhost:3000']);
        expect(getCorsOrigins(env({}))).toEqual(['http://localhost:5173', 'http://localhost:3000']);
    });
});

describe('allowsLocalNetworkOrigins', () => {
    it('is on in development and when NODE_ENV is unset', () => {
        expect(allowsLocalNetworkOrigins(env({ NODE_ENV: 'development' }))).toBe(true);
        expect(allowsLocalNetworkOrigins(env({}))).toBe(true);
    });

    it('is off in production, with or without CORS_ORIGINS', () => {
        expect(allowsLocalNetworkOrigins(env({ NODE_ENV: 'production' }))).toBe(false);
        expect(allowsLocalNetworkOrigins(env({ NODE_ENV: 'production', CORS_ORIGINS: 'https://a.example.com' }))).toBe(false);
    });

    it('is off when CORS_ORIGINS lists origins explicitly, even in development', () => {
        expect(allowsLocalNetworkOrigins(env({ NODE_ENV: 'development', CORS_ORIGINS: 'http://localhost:5173' }))).toBe(false);
    });
});

describe('isLocalNetworkOrigin', () => {
    it.each([
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.1.2.3:5173',
        'http://[::1]:5173',
        'http://0.0.0.0:5173',
        'http://192.168.1.15:5173',
        'http://10.0.0.7:5173',
        'http://172.16.0.1:5173',
        'http://172.31.255.254:5173',
        'https://192.168.0.2',
    ])('accepts %s', origin => {
        expect(isLocalNetworkOrigin(origin)).toBe(true);
    });

    it.each([
        'https://example.com',
        'http://8.8.8.8:5173',
        'http://172.15.0.1:5173',
        'http://172.32.0.1:5173',
        'http://192.169.1.1:5173',
        'http://11.0.0.1:5173',
        'http://999.168.1.1:5173',
        'http://localhost.example.com',
        'http://192.168.1.1.example.com',
        'http://example.com:5173/localhost',
        'ftp://localhost',
        'file:///tmp/x',
        'null',
        '',
        'not a url',
    ])('rejects %s', origin => {
        expect(isLocalNetworkOrigin(origin)).toBe(false);
    });
});
