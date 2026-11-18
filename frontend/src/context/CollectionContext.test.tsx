import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CollectionProvider, useCollectionContext } from './CollectionContext';
import { getCollection } from '../api/collection';
import type { CollectionItem } from '../types/collection.types';

vi.mock('../api/collection', () => ({
    getCollection: vi.fn(),
    removeFromCollection: vi.fn(),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const item = (id: string) => ({ _id: id }) as CollectionItem;
const wrapper = ({ children }: { children: ReactNode }) => <CollectionProvider>{children}</CollectionProvider>;

describe('CollectionContext - refreshCollection', () => {
    beforeEach(() => {
        vi.mocked(getCollection).mockReset();
    });

    it('updates the list in place without the loading state when silent', async () => {
        vi.mocked(getCollection).mockResolvedValueOnce([item('a')]);
        const { result } = renderHook(() => useCollectionContext(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const loadingStates: boolean[] = [];
        let resolve!: (items: CollectionItem[]) => void;
        vi.mocked(getCollection).mockReturnValueOnce(new Promise(r => { resolve = r; }));

        let refresh!: Promise<void>;
        act(() => { refresh = result.current.refreshCollection({ silent: true }); });
        loadingStates.push(result.current.isLoading);
        await act(async () => { resolve([item('a'), item('b')]); await refresh; });

        expect(loadingStates).toEqual([false]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.collection.map(i => i._id)).toEqual(['a', 'b']);
    });

    it('shows the loading state on a normal refresh', async () => {
        vi.mocked(getCollection).mockResolvedValueOnce([]);
        const { result } = renderHook(() => useCollectionContext(), { wrapper });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let resolve!: (items: CollectionItem[]) => void;
        vi.mocked(getCollection).mockReturnValueOnce(new Promise(r => { resolve = r; }));

        let refresh!: Promise<void>;
        act(() => { refresh = result.current.refreshCollection(); });
        expect(result.current.isLoading).toBe(true);
        await act(async () => { resolve([]); await refresh; });
        expect(result.current.isLoading).toBe(false);
    });
});
