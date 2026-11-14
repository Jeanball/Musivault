import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreferences, updatePreferences } from '../../api/preferences';
import { getCustomFields } from '../../api/customFields';
import {
    DEFAULT_TABLE_COLUMNS,
    normalizeTableColumns,
    tableColumnsFromPreference,
    type TableColumnKey,
} from '../../constants/tableColumns';
import type { CustomFieldDefinition } from '../../types/customFields.types';

/**
 * Loads the collection table's visible columns from the user's preferences and
 * keeps them in sync. Custom-field definitions travel with them because a
 * column is only usable while its field still exists.
 *
 * Saves are chained rather than fired in parallel: each request carries the
 * whole selection, so an earlier answer landing last would silently undo the
 * user's latest tick.
 */
export function useTableColumns(enabled = true, onSaveError?: () => void) {
    const [columns, setColumns] = useState<TableColumnKey[]>(() => [...DEFAULT_TABLE_COLUMNS]);
    const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(enabled);

    const saveChain = useRef<Promise<unknown>>(Promise.resolve());
    const onSaveErrorRef = useRef(onSaveError);

    useEffect(() => {
        onSaveErrorRef.current = onSaveError;
    }, [onSaveError]);

    useEffect(() => {
        if (!enabled) {
            setCustomFields([]);
            setColumns([...DEFAULT_TABLE_COLUMNS]);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        // AllSettled on purpose: losing the custom fields must not also lose the
        // base columns the user chose, and vice versa.
        Promise.allSettled([getPreferences(), getCustomFields()]).then(([prefsResult, fieldsResult]) => {
            if (cancelled) return;

            const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
            const prefs = prefsResult.status === 'fulfilled' ? prefsResult.value : null;

            setCustomFields(fields);
            setColumns(tableColumnsFromPreference(prefs?.tableColumns, fields));
            setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    const persist = useCallback((next: TableColumnKey[]) => {
        saveChain.current = saveChain.current
            .catch(() => undefined)
            .then(() => updatePreferences({ tableColumns: next }))
            .catch((error) => {
                console.error('Failed to save the table columns:', error);
                onSaveErrorRef.current?.();
            });
    }, []);

    const changeColumns = useCallback(
        (next: TableColumnKey[]) => {
            const ordered = normalizeTableColumns(next, customFields);
            // A table with no columns would look broken; the UI disables the
            // last tick, and this guard keeps a stale event from getting there.
            if (ordered.length === 0) return;

            setColumns(ordered);
            persist(ordered);
        },
        [customFields, persist]
    );

    const resetColumns = useCallback(() => {
        setColumns([...DEFAULT_TABLE_COLUMNS]);
        // An empty preference means "use the defaults", so columns added to the
        // app later show up for users who never customised anything.
        persist([]);
    }, [persist]);

    return { columns, customFields, isLoading, changeColumns, resetColumns };
}
