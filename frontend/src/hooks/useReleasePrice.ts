import { useEffect, useState } from 'react';
import { getReleasePrice } from '../api/discogs';
import type { ConditionPrices } from '../types/collection.types';

interface UseReleasePrice {
    price: ConditionPrices | null;
    isLoading: boolean;
}

/**
 * Live price suggestions for one release. Pass null to fetch nothing, so the
 * add flow prices a release only once the user has picked it.
 */
export function useReleasePrice(releaseId: number | null): UseReleasePrice {
    const [price, setPrice] = useState<ConditionPrices | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!releaseId) {
            setPrice(null);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();
        setPrice(null);
        setIsLoading(true);

        getReleasePrice(releaseId, controller.signal)
            .then(result => {
                if (controller.signal.aborted) return;
                setPrice(result);
                setIsLoading(false);
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                // A missing price is not worth an error state: the block hides itself.
                setPrice(null);
                setIsLoading(false);
            });

        return () => controller.abort();
    }, [releaseId]);

    return { price, isLoading };
}
