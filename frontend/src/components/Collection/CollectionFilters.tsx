import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FilterState, LayoutType } from '../../types/collection';

interface CollectionFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    availableFormats: string[];
    availableDecades: string[];
    availableStyles: string[];
    styleCounts: Record<string, number>;
    totalResults: number;
    filteredResults: number;
    onClearAll?: () => void;
    layout?: LayoutType;
    onLayoutChange?: (layout: LayoutType) => void;
}

const CollectionFilters: React.FC<CollectionFiltersProps> = ({
    filters,
    onFiltersChange,
    availableFormats,
    availableDecades,
    availableStyles,
    styleCounts,
    totalResults,
    filteredResults,
    onClearAll,
    layout,
    onLayoutChange
}) => {
    const { t } = useTranslation();
    const handleFilterChange = (key: keyof FilterState, value: string) => {
        onFiltersChange({
            ...filters,
            [key]: value
        });
    };

    return (
        <div className="bg-base-100 rounded-box shadow-lg p-3 md:p-4 mb-6">
            {/* Top row: Layout toggle + Results/Clear */}
            {layout && onLayoutChange && (
                <div className="flex items-center justify-center relative mb-3 pb-3 border-b border-base-300">
                    <div className="join">
                        <button
                            className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onLayoutChange('grid')}
                            title="Grid view"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <span className="hidden sm:inline ml-1">{t('collection.grid')}</span>
                        </button>
                        <button
                            className={`btn join-item btn-sm ${layout === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onLayoutChange('list')}
                            title="List view"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            <span className="hidden sm:inline ml-1">{t('collection.list')}</span>
                        </button>
                        <button
                            className={`btn join-item btn-sm ${layout === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => onLayoutChange('table')}
                            title="Table view"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline ml-1">{t('collection.table')}</span>
                        </button>
                    </div>

                    <div className="absolute right-0 flex items-center gap-3">
                        <span className="text-sm opacity-70">
                            {filteredResults} / {totalResults}
                        </span>
                        {onClearAll && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={onClearAll}
                                title="Clear all filters"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="hidden sm:inline">{t('collection.clear')}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom row: Filter dropdowns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                {/* Filter by Format */}
                <div className="form-control">
                    <label className="label py-0.5 md:py-1">
                        <span className="label-text text-xs">{t('common.format')}</span>
                    </label>
                    <select
                        className="select select-bordered select-sm w-full"
                        value={filters.format}
                        onChange={(e) => handleFilterChange('format', e.target.value)}
                    >
                        <option value="all">{t('collection.allFormats')}</option>
                        {availableFormats.map(format => (
                            <option key={format} value={format}>{format}</option>
                        ))}
                    </select>
                </div>

                {/* Filter by Decade */}
                <div className="form-control">
                    <label className="label py-0.5 md:py-1">
                        <span className="label-text text-xs">{t('collection.decade')}</span>
                    </label>
                    <select
                        className="select select-bordered select-sm w-full"
                        value={filters.decade}
                        onChange={(e) => handleFilterChange('decade', e.target.value)}
                    >
                        <option value="all">{t('collection.allDecades')}</option>
                        {availableDecades.sort().map(decade => (
                            <option key={decade} value={decade}>{decade}</option>
                        ))}
                    </select>
                </div>

                {/* Filter by Added Period */}
                <div className="form-control">
                    <label className="label py-0.5 md:py-1">
                        <span className="label-text text-xs">{t('collection.added')}</span>
                    </label>
                    <select
                        className="select select-bordered select-sm w-full"
                        value={filters.addedPeriod}
                        onChange={(e) => handleFilterChange('addedPeriod', e.target.value)}
                    >
                        <option value="all">{t('collection.anyTime')}</option>
                        <option value="thisWeek">{t('collection.thisWeek')}</option>
                        <option value="thisMonth">{t('collection.thisMonth')}</option>
                        <option value="thisYear">{t('collection.thisYear')}</option>
                        <option value="lastYear">{t('collection.lastYear')}</option>
                    </select>
                </div>

                {/* Filter by Style */}
                <div className="form-control">
                    <label className="label py-0.5 md:py-1">
                        <span className="label-text text-xs">{t('collection.style')}</span>
                    </label>
                    <select
                        className="select select-bordered select-sm w-full"
                        value={filters.style}
                        onChange={(e) => handleFilterChange('style', e.target.value)}
                    >
                        <option value="all">{t('collection.allStyles')}</option>
                        {availableStyles.map(style => (
                            <option key={style} value={style}>{style} ({styleCounts[style] || 0})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Active filters indicators */}
            {(filters.format !== 'all' || filters.decade !== 'all' || filters.addedPeriod !== 'all' || filters.style !== 'all') && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-base-300">
                    {filters.format !== 'all' && (
                        <div className="badge badge-primary gap-1">
                            {t('common.format')}: {filters.format}
                            <button
                                className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                                onClick={() => handleFilterChange('format', 'all')}
                            >
                                ×
                            </button>
                        </div>
                    )}
                    {filters.decade !== 'all' && (
                        <div className="badge badge-secondary gap-1">
                            {t('collection.decade')}: {filters.decade}
                            <button
                                className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                                onClick={() => handleFilterChange('decade', 'all')}
                            >
                                ×
                            </button>
                        </div>
                    )}
                    {filters.addedPeriod !== 'all' && (
                        <div className="badge badge-accent gap-1">
                            {t('collection.period')}: {filters.addedPeriod === 'thisWeek' ? t('collection.thisWeek') :
                                filters.addedPeriod === 'thisMonth' ? t('collection.thisMonth') :
                                    filters.addedPeriod === 'thisYear' ? t('collection.thisYear') : t('collection.lastYear')}
                            <button
                                className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                                onClick={() => handleFilterChange('addedPeriod', 'all')}
                            >
                                ×
                            </button>
                        </div>
                    )}
                    {filters.style !== 'all' && (
                        <div className="badge badge-info gap-1">
                            {t('collection.style')}: {filters.style}
                            <button
                                className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                                onClick={() => handleFilterChange('style', 'all')}
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CollectionFilters;
