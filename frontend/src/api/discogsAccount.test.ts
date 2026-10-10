import { describe, it, expect, vi, beforeEach } from 'vitest';
import { client } from './client';
import { getDiscogsAccount, connectDiscogsAccount, disconnectDiscogsAccount } from './discogsAccount';

describe('api/discogsAccount', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('reads the connection status', async () => {
        const status = { available: true, canUseServerAccount: false, connection: null };
        const get = vi.spyOn(client, 'get').mockResolvedValue({ data: status });

        expect(await getDiscogsAccount()).toEqual(status);
        expect(get).toHaveBeenCalledWith('/discogs-account');
    });

    it('connects with the server account without sending a token', async () => {
        const put = vi.spyOn(client, 'put').mockResolvedValue({ data: {} });

        await connectDiscogsAccount({ source: 'server' });

        expect(put).toHaveBeenCalledWith('/discogs-account', { source: 'server' });
    });

    it('connects with the users own token', async () => {
        const put = vi.spyOn(client, 'put').mockResolvedValue({ data: {} });

        await connectDiscogsAccount({ source: 'own', token: 'abc' });

        expect(put).toHaveBeenCalledWith('/discogs-account', { source: 'own', token: 'abc' });
    });

    it('disconnects', async () => {
        const del = vi.spyOn(client, 'delete').mockResolvedValue({ data: {} });

        await disconnectDiscogsAccount();

        expect(del).toHaveBeenCalledWith('/discogs-account');
    });
});
