import { describe, expect, it } from 'vitest';
import { collectionExportFilename } from './exportFilename';

describe('collectionExportFilename', () => {
    it('includes the local date and time of the export', () => {
        const name = collectionExportFilename(new Date(2026, 10, 14, 9, 5, 7));

        expect(name).toBe('musivault_collection_2026-11-14_09-05-07.csv');
    });

    it('gives two exports made on the same day different names', () => {
        const morning = collectionExportFilename(new Date(2026, 10, 14, 9, 0, 0));
        const evening = collectionExportFilename(new Date(2026, 10, 14, 21, 30, 15));

        expect(morning).not.toBe(evening);
    });
});
