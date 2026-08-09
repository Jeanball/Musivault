import { useEffect, useState } from 'react';
import { getSyncInfo } from '../../api/collection';
import type { CollectionSyncInfo } from '../../api/collection';

/**
 * When the next automatic price sync is due, for the stats banner.
 *
 * Purely informational: refreshing the chart is not driven from here. lastSyncedAt
 * only tracks priceCache, so it would miss an add or a delete made elsewhere.
 */
export const useCollectionSyncInfo = (enabled: boolean) => {
    const [syncInfo, setSyncInfo] = useState<CollectionSyncInfo | null>(null);

    useEffect(() => {
        if (!enabled) {
            setSyncInfo(null);
            return;
        }

        let active = true;
        getSyncInfo()
            .then(info => { if (active) setSyncInfo(info); })
            .catch(error => {
                console.error('Failed to load collection sync info:', error);
                if (active) setSyncInfo(null);
            });

        return () => { active = false; };
    }, [enabled]);

    return syncInfo;
};
