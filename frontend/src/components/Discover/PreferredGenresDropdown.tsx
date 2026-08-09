import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { getCollectionStyles } from '../../api/collection';
import { getPreferences, updatePreferences } from '../../api/preferences';

interface PreferredGenresDropdownProps {
    /** Called after the preference is saved, so the parent can refetch releases. */
    onSaved: () => void;
}

/**
 * Checkbox menu over the user's own collection styles. Unchecked styles are
 * stored in preferences (discoverExcludedStyles) and filtered server-side.
 * Changes stay local until the user hits Save — no request per checkbox.
 */
const PreferredGenresDropdown: React.FC<PreferredGenresDropdownProps> = ({ onSaved }) => {
    const { t } = useTranslation();
    const [collectionStyles, setCollectionStyles] = useState<string[]>([]);
    const [excludedStyles, setExcludedStyles] = useState<Set<string>>(new Set());
    const [draftExcluded, setDraftExcluded] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking anywhere outside the dropdown.
    useEffect(() => {
        if (!isOpen) return;
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [isOpen]);

    useEffect(() => {
        const fetchGenrePreferences = async () => {
            try {
                const [styles, prefs] = await Promise.all([getCollectionStyles(), getPreferences()]);
                setCollectionStyles(styles);
                const saved = new Set(prefs.discoverExcludedStyles || []);
                setExcludedStyles(saved);
                setDraftExcluded(new Set(saved));
            } catch (err) {
                console.error('Failed to load genre preferences:', err);
            }
        };
        fetchGenrePreferences();
    }, []);

    const toggleDraftStyle = (style: string) => {
        setDraftExcluded((prev) => {
            const next = new Set(prev);
            if (next.has(style)) {
                next.delete(style);
            } else {
                next.add(style);
            }
            return next;
        });
    };

    const setAllDraft = (checked: boolean) => {
        setDraftExcluded(checked ? new Set() : new Set(collectionStyles));
    };

    const isDirty = useMemo(() => {
        if (draftExcluded.size !== excludedStyles.size) return true;
        for (const s of draftExcluded) {
            if (!excludedStyles.has(s)) return true;
        }
        return false;
    }, [draftExcluded, excludedStyles]);

    const save = async () => {
        setIsSaving(true);
        try {
            await updatePreferences({ discoverExcludedStyles: Array.from(draftExcluded) });
            setExcludedStyles(new Set(draftExcluded));
            onSaved();
        } catch (err) {
            console.error('Failed to save genre preferences:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (collectionStyles.length === 0) return null;

    // Full width on mobile: dropdown-end would anchor the 18rem panel to the
    // button's right edge and push it off the left of a narrow screen.
    return (
        <div ref={containerRef} className={`dropdown w-full sm:w-auto sm:dropdown-end ${isOpen ? 'dropdown-open' : ''}`}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="btn btn-outline btn-sm gap-2 w-full sm:w-auto"
                aria-expanded={isOpen}
            >
                <SlidersHorizontal size={16} />
                {t('discover.preferredGenres')}
                {excludedStyles.size > 0 && (
                    <span className="badge badge-sm badge-neutral">
                        {collectionStyles.length - excludedStyles.size}/{collectionStyles.length}
                    </span>
                )}
            </button>
            {isOpen && (
            <div className="dropdown-content z-50 mt-2 p-3 shadow-lg bg-base-200 border border-base-300 rounded-box w-full sm:w-72">
                <p className="text-xs text-base-content/60 mb-2">
                    {t('discover.preferredGenresHint')}
                </p>
                <div className="flex gap-2 mb-2">
                    <button className="btn btn-ghost btn-xs" onClick={() => setAllDraft(true)}>
                        {t('discover.checkAll')}
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => setAllDraft(false)}>
                        {t('discover.uncheckAll')}
                    </button>
                </div>
                <div className="max-h-64 overflow-y-auto mb-3">
                    {collectionStyles.map((style) => (
                        <label key={style} className="label cursor-pointer justify-start gap-3 py-1">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary"
                                checked={!draftExcluded.has(style)}
                                onChange={() => toggleDraftStyle(style)}
                            />
                            <span className="text-sm text-sm">{style}</span>
                        </label>
                    ))}
                </div>
                <button
                    className="btn btn-primary btn-sm w-full"
                    disabled={!isDirty || isSaving}
                    onClick={save}
                >
                    {isSaving && <span className="loading loading-spinner loading-xs"></span>}
                    {t('common.save')}
                </button>
            </div>
            )}
        </div>
    );
};

export default PreferredGenresDropdown;
