import { useCallback, useEffect, useState } from 'react';
import { getValueHistory } from '../../api/collection';
import type { ValuePoint } from '../../api/collection';

/**
 * The stored value history behind the stats chart.
 *
 * Reading it is what refreshes the current day server-side, so `reload` is also
 * how an add, a delete or a manual price sync makes its way onto the curve.
 */
export const useValueHistory = () => {
    const [points, setPoints] = useState<ValuePoint[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const load = useCallback(async () => {
        try {
            return await getValueHistory();
        } catch (error) {
            console.error('Failed to load collection value history:', error);
            return null;
        }
    }, []);

    useEffect(() => {
        let active = true;
        load().then(history => {
            if (!active) return;
            if (history) setPoints(history);
            setIsLoading(false);
        });
        return () => { active = false; };
    }, [load]);

    const reload = useCallback(async () => {
        const history = await load();
        if (history) setPoints(history);
    }, [load]);

    return { points, isLoading, reload };
};
