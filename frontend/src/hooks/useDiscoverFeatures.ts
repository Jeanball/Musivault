import { useEffect, useState } from 'react';
import { getDiscoverFeatures, type DiscoverFeatures } from '../api/discover';

/**
 * Which optional Discover features the server is set up for, or `null` while
 * that is still unknown. If the lookup fails, every feature is assumed on: the
 * per-feature requests then report their own state, as they did before.
 */
export function useDiscoverFeatures(): DiscoverFeatures | null {
    const [features, setFeatures] = useState<DiscoverFeatures | null>(null);

    useEffect(() => {
        let active = true;
        getDiscoverFeatures()
            .then((found) => { if (active) setFeatures(found); })
            .catch(() => { if (active) setFeatures({ concerts: true }); });
        return () => { active = false; };
    }, []);

    return features;
}
