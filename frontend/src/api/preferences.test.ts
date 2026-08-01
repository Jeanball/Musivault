import { describe, it, expect, vi, beforeEach } from 'vitest';
import { client } from './client';
import {
    getPreferences,
    updatePreferences,
    clearPreferencesCache
} from './preferences';
import type { Preferences } from '../types/preferences.types';

const serverPreferences: Preferences = {
    theme: 'dark',
    isPublic: false,
    wideScreenMode: false,
    language: 'fr',
    enableConditionGrading: true,
    preferredCurrency: 'CAD',
    publicShareId: null
};

describe('api/preferences', () => {
    beforeEach(() => {
        clearPreferencesCache();
        vi.restoreAllMocks();
    });

    it('only hits the network once for repeated reads', async () => {
        const get = vi
            .spyOn(client, 'get')
            .mockResolvedValue({ data: serverPreferences });

        await getPreferences();
        await getPreferences();
        await getPreferences();

        expect(get).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent reads into a single request', async () => {
        const get = vi
            .spyOn(client, 'get')
            .mockResolvedValue({ data: serverPreferences });

        // What the settings page does: several panels mount at once.
        const results = await Promise.all([
            getPreferences(),
            getPreferences(),
            getPreferences(),
            getPreferences()
        ]);

        expect(get).toHaveBeenCalledTimes(1);
        expect(results.every(r => r.language === 'fr')).toBe(true);
    });

    it('refetches when forced, so a new session never reads stale values', async () => {
        const get = vi
            .spyOn(client, 'get')
            .mockResolvedValue({ data: serverPreferences });

        await getPreferences();
        await getPreferences(true);

        expect(get).toHaveBeenCalledTimes(2);
    });

    it('flattens the PUT response and serves it from cache afterwards', async () => {
        const put = vi.spyOn(client, 'put').mockResolvedValue({
            data: {
                message: 'Preferences updated successfully',
                preferences: { ...serverPreferences, isPublic: true },
                publicShareId: 'share-123'
            }
        });
        const get = vi.spyOn(client, 'get');

        const updated = await updatePreferences({ isPublic: true });

        // PUT nests preferences and returns publicShareId beside them; callers
        // must still see the same flat shape getPreferences returns.
        expect(updated.isPublic).toBe(true);
        expect(updated.publicShareId).toBe('share-123');
        expect(put).toHaveBeenCalledWith('/preferences', { isPublic: true });

        // The write primed the cache, so no read should follow.
        await getPreferences();
        expect(get).not.toHaveBeenCalled();
    });
});
