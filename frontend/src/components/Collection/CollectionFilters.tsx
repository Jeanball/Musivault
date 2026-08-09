import React, { useState } from 'react';
import { CircleAlert, SlidersHorizontal, Search, X, LayoutGrid, Rows3, Table2, Disc3, Music, Tag, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FilterState, LayoutType, CollectionViewMode } from '../../types/collection.types';

interface CollectionFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    availableFormats: string[];
    availableDecades: string[];
    availableStyles: string[];
    styleCounts: Record<string, number>;
    availableLabels: string[];
    labelCounts: Record<string, number>;
    totalResults: number;
    filteredResults: number;
    onClearAll?: () => void;
    issueCount?: number;
    /** Omitted on the public collection, which only ever lists albums. */
    viewMode?: CollectionViewMode;
    onViewModeChange?: (mode: CollectionViewMode) => void;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
    /**
     * False in the tracks and labels modes, which carry their own search field.
     * The term keeps filtering, so it surfaces as a removable chip instead of
     * narrowing the results with nothing on screen to explain it.
     */
    showSearchField?: boolean;
    /** Omitted where the layouts have nothing to draw. */
    layout?: LayoutType;
    onLayoutChange?: (layout: LayoutType) => void;
}

const LAYOUTS: { value: LayoutType; labelKey: string; Icon: React.ElementType }[] = [
    { value: 'grid', labelKey: 'collection.grid', Icon: LayoutGrid },
    { value: 'list', labelKey: 'collection.list', Icon: Rows3 },
    { value: 'table', labelKey: 'collection.table', Icon: Table2 },
];

/** What the page lists. Changing it swaps the content wholesale. */
const VIEW_MODES: { mode: CollectionViewMode; labelKey: string; Icon: React.ElementType }[] = [
    { mode: 'albums', labelKey: 'common.albums', Icon: Disc3 },
    { mode: 'tracks', labelKey: 'common.tracks', Icon: Music },
    { mode: 'labels', labelKey: 'common.labels', Icon: Tag },
];

const CollectionFilters: React.FC<CollectionFiltersProps> = ({
    filters,
    onFiltersChange,
    availableFormats,
    availableDecades,
    availableStyles,
    styleCounts,
    availableLabels,
    labelCounts,
    totalResults,
    filteredResults,
    onClearAll,
    issueCount = 0,
    viewMode,
    onViewModeChange,
    searchTerm,
    onSearchChange,
    showSearchField = true,
    layout,
    onLayoutChange
}) => {
    const { t } = useTranslation();
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const showViewMode = !!viewMode && !!onViewModeChange;
    const currentMode = VIEW_MODES.find((m) => m.mode === viewMode) ?? VIEW_MODES[0];
    const CurrentModeIcon = currentMode.Icon;

    const showIssueToggle = issueCount >= 1 || filters.issueStatus === 'issues';
    const showSearch = showSearchField && searchTerm !== undefined && !!onSearchChange;
    const orphanedSearch = !showSearchField && !!searchTerm;
    const showLayouts = !!layout && !!onLayoutChange;

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    /** Drives the count on the Filters button and the chip row below it. */
    const activeChips: { key: keyof FilterState; label: string; value: string }[] = [];
    if (filters.format !== 'all') {
        activeChips.push({ key: 'format', label: t('common.format'), value: filters.format });
    }
    if (filters.decade !== 'all') {
        activeChips.push({ key: 'decade', label: t('collection.decade'), value: filters.decade });
    }
    if (filters.addedPeriod !== 'all') {
        activeChips.push({
            key: 'addedPeriod',
            label: t('collection.period'),
            value: t(`collection.${filters.addedPeriod}`),
        });
    }
    if (filters.style !== 'all') {
        activeChips.push({ key: 'style', label: t('collection.style'), value: filters.style });
    }
    if (filters.label !== 'all') {
        activeChips.push({ key: 'label', label: t('album.label'), value: filters.label });
    }

    return (
        <div className="bg-base-100 rounded-box shadow-lg p-3 md:p-4 mb-6 flex flex-col gap-3">
            {/* What you type, what you narrow, how it's drawn — one row on desktop,
                with the layouts dropping to their own centred line on a phone. */}
            <div className="flex flex-wrap items-center gap-2">
                {showSearch && (
                    <label className="input w-full sm:w-auto sm:flex-1 sm:min-w-48">
                        <Search size={16} className="opacity-50 shrink-0" />
                        <input
                            type="search"
                            placeholder={t('collection.searchAlbum')}
                            value={searchTerm}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                        />
                    </label>
                )}

                <button
                    className={`btn btn-sm ${isPanelOpen || activeChips.length > 0 ? 'btn-active' : ''}`}
                    onClick={() => setIsPanelOpen((open) => !open)}
                    aria-expanded={isPanelOpen}
                >
                    <SlidersHorizontal size={16} />
                    {t('collection.filters')}
                    {activeChips.length > 0 && (
                        <span className="badge badge-primary badge-sm">{activeChips.length}</span>
                    )}
                </button>

                {/* Switching what the page lists is a rare trip — it gets a quiet
                    menu, not the first thing the eye lands on. */}
                {showViewMode && (
                    <div className="dropdown dropdown-end">
                        <button tabIndex={0} className="btn btn-sm btn-ghost">
                            <CurrentModeIcon size={16} />
                            <span className="hidden sm:inline">{t(currentMode.labelKey)}</span>
                            <ChevronDown size={14} className="opacity-60" />
                        </button>
                        <ul tabIndex={0} className="dropdown-content menu menu-sm z-20 mt-1 w-44 rounded-box bg-base-200 p-1 shadow-lg">
                            {VIEW_MODES.map(({ mode, labelKey, Icon }) => (
                                <li key={mode}>
                                    <button
                                        className={viewMode === mode ? 'active' : ''}
                                        onClick={() => onViewModeChange?.(mode)}
                                    >
                                        <Icon size={16} />
                                        {t(labelKey)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {showLayouts && (
                    /* order-first on a phone: the layout you're in frames everything
                       below it, so it leads rather than trailing the toolbar. */
                    <div className="join w-full justify-center sm:w-auto order-first sm:order-0">
                        {LAYOUTS.map(({ value, labelKey, Icon }) => (
                            <button
                                key={value}
                                className={`btn join-item btn-sm flex-1 sm:flex-none ${layout === value ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => onLayoutChange?.(value)}
                                aria-pressed={layout === value}
                                title={t(labelKey)}
                            >
                                <Icon size={16} />
                                <span className="hidden sm:inline lg:inline">{t(labelKey)}</span>
                            </button>
                        ))}
                    </div>
                )}

                {showIssueToggle && (
                    <label className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200/70 px-3 py-1.5 cursor-pointer">
                        <span className="tooltip tooltip-left flex items-center" data-tip={t('collection.issuesOnly')}>
                            <CircleAlert size={16} className="text-warning" />
                        </span>
                        <input
                            type="checkbox"
                            className="toggle toggle-warning toggle-sm shrink-0"
                            checked={filters.issueStatus === 'issues'}
                            onChange={(e) => handleFilterChange('issueStatus', e.target.checked ? 'issues' : 'all')}
                            aria-label={t('collection.issuesOnly')}
                        />
                    </label>
                )}
            </div>

            {/* Folded away by default: five dropdowns held two permanent rows for a
                setting most visits never touch. */}
            {isPanelOpen && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4 pt-3 border-t border-base-300">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-base-content/60">{t('common.format')}</span>
                        <select
                            className="select select-sm w-full"
                            value={filters.format}
                            onChange={(e) => handleFilterChange('format', e.target.value)}
                        >
                            <option value="all">{t('collection.allFormats')}</option>
                            {availableFormats.map(format => (
                                <option key={format} value={format}>{format}</option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-base-content/60">{t('collection.decade')}</span>
                        <select
                            className="select select-sm w-full"
                            value={filters.decade}
                            onChange={(e) => handleFilterChange('decade', e.target.value)}
                        >
                            <option value="all">{t('collection.allDecades')}</option>
                            {availableDecades.map(decade => (
                                <option key={decade} value={decade}>{decade}</option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-base-content/60">{t('collection.added')}</span>
                        <select
                            className="select select-sm w-full"
                            value={filters.addedPeriod}
                            onChange={(e) => handleFilterChange('addedPeriod', e.target.value)}
                        >
                            <option value="all">{t('collection.anyTime')}</option>
                            <option value="thisWeek">{t('collection.thisWeek')}</option>
                            <option value="thisMonth">{t('collection.thisMonth')}</option>
                            <option value="thisYear">{t('collection.thisYear')}</option>
                            <option value="lastYear">{t('collection.lastYear')}</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-base-content/60">{t('collection.style')}</span>
                        <select
                            className="select select-sm w-full"
                            value={filters.style}
                            onChange={(e) => handleFilterChange('style', e.target.value)}
                        >
                            <option value="all">{t('collection.allStyles')}</option>
                            {availableStyles.map(style => (
                                <option key={style} value={style}>{style} ({styleCounts[style] || 0})</option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-base-content/60">{t('album.label')}</span>
                        <select
                            className="select select-sm w-full"
                            value={filters.label}
                            onChange={(e) => handleFilterChange('label', e.target.value)}
                        >
                            <option value="all">{t('collection.allLabels')}</option>
                            {availableLabels.map(label => (
                                <option key={label} value={label}>{label} ({labelCounts[label] || 0})</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {/* The chips are the only place a filter is removed, so they stay put
                whether the panel is open or not. Neutral on purpose: the five
                different badge colours encoded nothing. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {orphanedSearch && (
                        <button
                            className="badge badge-outline gap-1.5 hover:badge-neutral"
                            onClick={() => onSearchChange?.('')}
                            title={t('collection.clear')}
                        >
                            <Search size={12} className="opacity-60" />
                            <span className="font-semibold">{searchTerm}</span>
                            <X size={12} className="opacity-60" />
                        </button>
                    )}
                    {activeChips.map(({ key, label, value }) => (
                        <button
                            key={key}
                            className="badge badge-outline gap-1.5 hover:badge-neutral"
                            onClick={() => handleFilterChange(key, 'all')}
                            title={t('collection.clear')}
                        >
                            <span className="opacity-60">{label}</span>
                            <span className="font-semibold">{value}</span>
                            <X size={12} className="opacity-60" />
                        </button>
                    ))}
                    {onClearAll && (
                        <button className="btn btn-ghost btn-xs" onClick={onClearAll}>
                            {t('collection.clearAllFilters')}
                        </button>
                    )}
                </div>

                <span className="text-sm text-base-content/60 tabular-nums">
                    {t('collection.showingCount', { shown: filteredResults, total: totalResults })}
                </span>
            </div>
        </div>
    );
};

export default CollectionFilters;
