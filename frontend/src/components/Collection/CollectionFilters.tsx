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
        <div className="bg-base-100 rounded-box shadow-lg p-4 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                {/* Filtres */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Filtre par Format */}
                    <div className="form-control">
                        <label className="label label-text text-xs">Format</label>
                        <select 
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={filters.format}
                            onChange={(e) => handleFilterChange('format', e.target.value)}
                        >
                            <option value="all">Tous les formats</option>
                            {availableFormats.map(format => (
                                <option key={format} value={format}>{format}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtre par Décennie */}
                    <div className="form-control">
                        <label className="label label-text text-xs">Décennie</label>
                        <select 
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={filters.decade}
                            onChange={(e) => handleFilterChange('decade', e.target.value)}
                        >
                            <option value="all">Toutes les décennies</option>
                            {availableDecades.sort().map(decade => (
                                <option key={decade} value={decade}>{decade}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtre par Période d'ajout */}
                    <div className="form-control">
                        <label className="label label-text text-xs">Ajouté</label>
                        <select 
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={filters.addedPeriod}
                            onChange={(e) => handleFilterChange('addedPeriod', e.target.value)}
                        >
                            <option value="all">Toutes les périodes</option>
                            <option value="thisWeek">Cette semaine</option>
                            <option value="thisMonth">Ce mois</option>
                            <option value="thisYear">Cette année</option>
                            <option value="lastYear">L'année dernière</option>
                        </select>
                    </div>
                </div>

                {/* Résultats et Reset */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="text-sm text-gray-500">
                        {filteredResults} / {totalResults} albums
                    </div>
                    
                    {hasActiveFilters && (
                        <button 
                            className="btn btn-ghost btn-sm"
                            onClick={resetFilters}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Effacer filtres
                        </button>
                    )}
                </div>
            </div>

            {/* Indicateurs de filtres actifs */}
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
                            Décennie: {filters.decade}
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
                            Période: {filters.addedPeriod === 'thisWeek' ? 'Cette semaine' : 
                                     filters.addedPeriod === 'thisMonth' ? 'Ce mois' :
                                     filters.addedPeriod === 'thisYear' ? 'Cette année' : 'L\'année dernière'}
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
