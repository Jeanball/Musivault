import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../config/logger.config', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/UpcomingRelease', () => ({ default: {} }));
vi.mock('../services/collection.service', () => ({ getUserStyles: vi.fn(), getUserArtists: vi.fn() }));
vi.mock('../services/geoip.service', () => ({ lookupIp: vi.fn() }));
vi.mock('../services/overpass.service', () => ({ getShopsForPosition: vi.fn(), geocodePlace: vi.fn() }));

import { getDiscoverFeatures } from './discover.controller';

function respond(user: unknown) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    getDiscoverFeatures({ user } as Request, res as unknown as Response);
    return res;
}

describe('getDiscoverFeatures', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('reports concerts as available when the Ticketmaster key is set', () => {
        vi.stubEnv('TICKETMASTER_API_KEY', 'abc');
        const res = respond({ id: 'u1' });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ concerts: true });
    });

    it('reports concerts as unavailable when the key is missing or empty', () => {
        vi.stubEnv('TICKETMASTER_API_KEY', '');
        const res = respond({ id: 'u1' });
        expect(res.json).toHaveBeenCalledWith({ concerts: false });
    });

    it('rejects an unauthenticated caller', () => {
        const res = respond(undefined);
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
