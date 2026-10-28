import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { getCollectionStyles } from '../../api/collection';
import { getPreferences, updatePreferences } from '../../api/preferences';
import { COMMON_STYLES } from '../../constants/discoverStyles';

interface PreferredGenresDropdownProps {
    /** Called after the preference is saved, so the parent can refetch releases. */
    onSaved: () => void;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((s) => b.has(s));

/**
 * Checkbox menu over the user's collection styles plus the ones they follow.
 * Unchecked collection styles are stored in preferences (discoverExcludedStyles)
 * and filtered server-side; followed styles (discoverIncludedStyles) can be
 * typed in, and unchecking one unfollows it. Changes stay local until the user
 * hits Save — no request per checkbox.
 */
const PreferredGenresDropdown: React.FC<PreferredGenresDropdownProps> = ({ onSaved }) => {
    const { t } = useTranslation();
    const [collectionStyles, setCollectionStyles] = useState<string[]>([]);
    const [excludedStyles, setExcludedStyles] = useState<Set<string>>(new Set());
    const [draftExcluded, setDraftExcluded] = useState<Set<string>>(new Set());
    const [followedStyles, setFollowedStyles] = useState<Set<string>>(new Set());
    const [draftFollowed, setDraftFollowed] = useState<Set<string>>(new Set());
    const [newStyle, setNewStyle] = useState('');
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
                const followed = new Set(prefs.discoverIncludedStyles || []);
                setFollowedStyles(followed);
                setDraftFollowed(new Set(followed));
            } catch (err) {
                console.error('Failed to load genre preferences:', err);
            }
        };
        fetchGenrePreferences();
    }, []);

    // Compared lowercase: followed styles are stored that way, collection ones keep Discogs' spelling.
    const collectionByKey = useMemo(
        () => new Map(collectionStyles.map((style) => [style.toLowerCase(), style])),
        [collectionStyles]
    );

    const allStyles = useMemo(() => {
        const followedOnly = [...draftFollowed].filter((style) => !collectionByKey.has(style));
        return [...collectionStyles, ...followedOnly].sort((a, b) => a.localeCompare(b));
    }, [collectionStyles, draftFollowed, collectionByKey]);

    const suggestions = useMemo(
        () => COMMON_STYLES.filter((style) => !collectionByKey.has(style) && !draftFollowed.has(style)),
        [collectionByKey, draftFollowed]
    );

    const isChecked = (style: string) =>
        collectionByKey.has(style.toLowerCase()) ? !draftExcluded.has(style) : draftFollowed.has(style);

    const toggleDraftStyle = (style: string) => {
        if (!collectionByKey.has(style.toLowerCase())) {
            // A followed style that isn't in the collection: unchecking it unfollows it.
            setDraftFollowed((prev) => {
                const next = new Set(prev);
                next.delete(style);
                return next;
            });
            return;
        }
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
        if (!checked) setDraftFollowed(new Set());
    };

    const addStyle = () => {
        const style = newStyle.trim().toLowerCase();
        if (!style) return;
        const owned = collectionByKey.get(style);
        if (owned) {
            // Already in the collection: following it just means showing it again.
            setDraftExcluded((prev) => {
                const next = new Set(prev);
                next.delete(owned);
                return next;
            });
        } else {
            setDraftFollowed((prev) => new Set(prev).add(style));
        }
        setNewStyle('');
    };

    const isDirty = useMemo(
        () => !sameSet(draftExcluded, excludedStyles) || !sameSet(draftFollowed, followedStyles),
        [draftExcluded, excludedStyles, draftFollowed, followedStyles]
    );

    const save = async () => {
        setIsSaving(true);
        try {
            await updatePreferences({
                discoverExcludedStyles: Array.from(draftExcluded),
                discoverIncludedStyles: Array.from(draftFollowed),
            });
            setExcludedStyles(new Set(draftExcluded));
            setFollowedStyles(new Set(draftFollowed));
            onSaved();
        } catch (err) {
            console.error('Failed to save genre preferences:', err);
        } finally {
            setIsSaving(false);
        }
    };

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
                        {collectionStyles.length - excludedStyles.size + followedStyles.size}/{collectionStyles.length + followedStyles.size}
                    </span>
                )}
            </button>
            {isOpen && (
            <div className="dropdown-content z-50 mt-2 p-3 shadow-dropdown bg-base-200 border border-base-300 rounded-box w-full sm:w-72">
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
                <form
                    className="join w-full mb-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        addStyle();
                    }}
                >
                    <input
                        type="text"
                        list="discover-style-suggestions"
                        className="input input-sm input-bordered join-item w-full"
                        placeholder={t('discover.followStylePlaceholder')}
                        value={newStyle}
                        maxLength={60}
                        onChange={(e) => setNewStyle(e.target.value)}
                    />
                    <datalist id="discover-style-suggestions">
                        {suggestions.map((style) => (
                            <option key={style} value={style} />
                        ))}
                    </datalist>
                    <button type="submit" className="btn btn-sm btn-primary join-item" disabled={!newStyle.trim()}>
                        {t('discover.followStyleAdd')}
                    </button>
                </form>
                <div className="max-h-64 overflow-y-auto mb-3">
                    {allStyles.map((style) => (
                        <label key={style} className="label cursor-pointer justify-start gap-3 py-1">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary"
                                checked={isChecked(style)}
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
