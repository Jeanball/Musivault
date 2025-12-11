import React from 'react';
import type { FilterState } from '../../types/collection';

interface CollectionFiltersProps {
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    availableFormats: string[];
    availableDecades: string[];
    totalResults: number;
    filteredResults: number;
}

const CollectionFilters: React.FC<CollectionFiltersProps> = ({
    filters,
    onFiltersChange,
    availableFormats,
    availableDecades,
    totalResults,
    filteredResults
}) => {
    const handleFilterChange = (key: keyof FilterState, value: string) => {
        onFiltersChange({
            ...filters,
            [key]: value
        });
    };

    const resetFilters = () => {
        onFiltersChange({
            format: 'all',
            decade: 'all',
            addedPeriod: 'all'
        });
    };

    const hasActiveFilters = filters.format !== 'all' || filters.decade !== 'all' || filters.addedPeriod !== 'all';

    return (
        <div className="bg-base-100 rounded-box shadow-lg p-3 md:p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center justify-between">
                {/* Filters - Always 3 columns, compact on mobile */}
                <div className="grid grid-cols-3 gap-2 md:gap-4 flex-1">
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
                </div>

                {/* Results and Reset */}
                <div className="flex flex-row items-center justify-between lg:justify-end gap-3">
                    <div className="text-xs md:text-sm text-gray-500">
                        {filteredResults} / {totalResults}
                    </div>

                    {hasActiveFilters && (
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={resetFilters}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="hidden sm:inline">Reset</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Active filters indicators */}
            {hasActiveFilters && (
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
                </div>
            )}
        </div>
    );
};

export default CollectionFilters;
