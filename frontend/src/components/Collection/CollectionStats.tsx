import React, { useState } from 'react';
import type { CollectionStats as CollectionStatsType } from '../../types/collection';

interface CollectionStatsProps {
    stats: CollectionStatsType;
}

const CollectionStats: React.FC<CollectionStatsProps> = ({ stats }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-base-100 rounded-box shadow-lg mb-4">
            {/* Header avec bouton toggle */}
            <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-base-200 rounded-t-box"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="stat-figure text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-6 h-6 stroke-current">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Statistiques de Collection</h3>
                        <p className="text-sm text-gray-500">
                            {stats.total} albums • {Object.keys(stats.formatCounts).length} formats • {Object.keys(stats.decadeCounts).length} décennies
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="badge badge-primary">{stats.total}</div>
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Contenu déroulant */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="stats stats-vertical lg:stats-horizontal w-full">
                    <div className="stat">
                        <div className="stat-figure text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                            </svg>
                        </div>
                        <div className="stat-title">Total Albums</div>
                        <div className="stat-value text-primary">{stats.total}</div>
                        <div className="stat-desc">
                            {stats.topArtist && `${stats.topArtist.name} (${stats.topArtist.count})`}
                        </div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path>
                            </svg>
                        </div>
                        <div className="stat-title">Formats</div>
                        <div className="stat-value text-secondary">{Object.keys(stats.formatCounts).length}</div>
                        <div className="stat-desc">
                            {Object.entries(stats.formatCounts)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 2)
                                .map(([format, count]) => `${format}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-accent">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div className="stat-title">Décennies</div>
                        <div className="stat-value text-accent">{Object.keys(stats.decadeCounts).length}</div>
                        <div className="stat-desc">
                            {Object.entries(stats.decadeCounts)
                                .sort(([,a], [,b]) => b - a)
                                .slice(0, 2)
                                .map(([decade, count]) => `${decade}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    <div className="stat">
                        <div className="stat-figure text-success">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div className="stat-title">Ajouts récents</div>
                        <div className="stat-value text-success">{stats.recentAdds.thisWeek}</div>
                        <div className="stat-desc">
                            Cette semaine • {stats.recentAdds.thisMonth} ce mois
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollectionStats;
