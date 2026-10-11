import { describe, it, expect, vi, beforeEach } from 'vitest';
import { client } from './client';
import { applyDiscogsSelection, getDiscogsReport, startDiscogsCheck } from './discogsSync';

describe('api/discogsSync', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('starts a check', async () => {
        const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { status: 'queued' } });

        await startDiscogsCheck();

        expect(post).toHaveBeenCalledWith('/discogs-sync/check');
    });

    it('unwraps the report', async () => {
        const report = { status: 'running', progress: { page: 1, pages: 3 } };
        const get = vi.spyOn(client, 'get').mockResolvedValue({ data: { report } });

        expect(await getDiscogsReport()).toEqual(report);
        expect(get).toHaveBeenCalledWith('/discogs-sync/report');
    });

    it('returns null before the first check', async () => {
        vi.spyOn(client, 'get').mockResolvedValue({ data: { report: null } });

        expect(await getDiscogsReport()).toBeNull();
    });

    it('sends the ticked rows to apply', async () => {
        const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { status: 'queued' } });
        const selection = { add: [1, 2], relink: [{ itemId: 'a', releaseId: 7 }], useDiscogsDates: false };

        await applyDiscogsSelection(selection);

        expect(post).toHaveBeenCalledWith('/discogs-sync/apply', selection);
    });
});
