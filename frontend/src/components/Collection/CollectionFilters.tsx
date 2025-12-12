import React from 'react';
import type { FilterState } from '../../types/collection';

interface CollectionFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    availableFormats: string[];
    availableDecades: string[];
    availableStyles: string[];
    totalResults: number;
    filteredResults: number;
    onClearAll?: () => void;
}

const CollectionFilters: React.FC<CollectionFiltersProps> = ({
    filters,
    onFiltersChange,
    availableFormats,
    availableDecades,
    availableStyles,
    totalResults,
    filteredResults,
    onClearAll
}) => {
    const handleFilterChange = (key: keyof FilterState, value: string) => {
        onFiltersChange({
            ...filters,
            [key]: value
        });
    };

    return (
        <div className="bg-base-100 rounded-box shadow-lg p-3 md:p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center justify-between">
                {/* Filters - 4 columns on desktop, 2 on mobile */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 flex-1">
                    {/* Filter by Format */}
                    <div className="form-control">
                        <label className="label py-0.5 md:py-1">
                            <span className="label-text text-xs">Format</span>
                        </label>
                        <select
                            className="select select-bordered select-xs md:select-sm w-full"
                            value={filters.format}
                            onChange={(e) => handleFilterChange('format', e.target.value)}
                        >
                            <option value="all">All</option>
                            {availableFormats.map(format => (
                                <option key={format} value={format}>{format}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Decade */}
                    <div className="form-control">
                        <label className="label py-0.5 md:py-1">
                            <span className="label-text text-xs">Decade</span>
                        </label>
                        <select
                            className="select select-bordered select-xs md:select-sm w-full"
                            value={filters.decade}
                            onChange={(e) => handleFilterChange('decade', e.target.value)}
                        >
                            <option value="all">All</option>
                            {availableDecades.sort().map(decade => (
                                <option key={decade} value={decade}>{decade}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Added Period */}
                    <div className="form-control">
                        <label className="label py-0.5 md:py-1">
                            <span className="label-text text-xs">Added</span>
                        </label>
                        <select
                            className="select select-bordered select-xs md:select-sm w-full"
                            value={filters.addedPeriod}
                            onChange={(e) => handleFilterChange('addedPeriod', e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="thisWeek">Week</option>
                            <option value="thisMonth">Month</option>
                            <option value="thisYear">Year</option>
                            <option value="lastYear">Last yr</option>
                        </select>
                    </div>

                    {/* Filter by Style */}
                    <div className="form-control">
                        <label className="label py-0.5 md:py-1">
                            <span className="label-text text-xs">Style</span>
                        </label>
                        <select
                            className="select select-bordered select-xs md:select-sm w-full"
                            value={filters.style}
                            onChange={(e) => handleFilterChange('style', e.target.value)}
                        >
                            <option value="all">All</option>
                            {availableStyles.map(style => (
                                <option key={style} value={style}>{style}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Results count and Clear All */}
                <div className="flex flex-row items-center justify-between lg:justify-end gap-3">
                    <div className="text-xs md:text-sm text-gray-500">
                        {filteredResults} / {totalResults}
                    </div>
                    {onClearAll && (
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={onClearAll}
                            title="Clear all filters"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="hidden sm:inline">Clear All</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Active filters indicators */}
            {(filters.format !== 'all' || filters.decade !== 'all' || filters.addedPeriod !== 'all' || filters.style !== 'all') && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-base-300">
                    {filters.format !== 'all' && (
                        <div className="badge badge-primary gap-1">
                            Format: {filters.format}
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
                            Decade: {filters.decade}
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
                            Period: {filters.addedPeriod === 'thisWeek' ? 'This week' :
                                filters.addedPeriod === 'thisMonth' ? 'This month' :
                                    filters.addedPeriod === 'thisYear' ? 'This year' : 'Last year'}
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
                            Style: {filters.style}
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
