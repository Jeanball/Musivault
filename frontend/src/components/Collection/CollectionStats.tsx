import React, { useState } from 'react';
import type { CollectionStats as CollectionStatsType } from '../../types/collection';

interface CollectionStatsProps {
    stats: CollectionStatsType;
}

const CollectionStats: React.FC<CollectionStatsProps> = ({ stats }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-base-100 rounded-box shadow-lg mb-4">
            {/* Header with toggle button */}
            <div
                className="flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer hover:bg-base-200 rounded-t-box gap-2"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 md:gap-3">
                    <h3 className="font-semibold text-base md:text-lg">Collection Stats</h3>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 md:h-5 md:w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                <p className="text-xs md:text-sm text-gray-500 text-center">
                    💿 {stats.total} • 🎚️ {Object.keys(stats.formatCounts).length} • 📅 {Object.keys(stats.decadeCounts).length} • ⏰ {stats.recentAdds.thisWeek} • 🏷️ {Object.keys(stats.styleCounts).length}
                </p>
            </div>

            {/* Collapsible content */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
                    {/* Total */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-primary mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
                        <div className="text-2xl font-bold text-primary">{stats.total}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.topArtist && `${stats.topArtist.name} (${stats.topArtist.count})`}
                        </div>
                    </div>

                    {/* Formats */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-secondary mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path>
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Formats</div>
                        <div className="text-2xl font-bold text-secondary">{Object.keys(stats.formatCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {Object.entries(stats.formatCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 2)
                                .map(([format, count]) => `${format}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    {/* Decades */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-accent mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Decades</div>
                        <div className="text-2xl font-bold text-accent">{Object.keys(stats.decadeCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {Object.entries(stats.decadeCounts)
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 2)
                                .map(([decade, count]) => `${decade}: ${count}`)
                                .join(', ')}
                        </div>
                    </div>

                    {/* Recent Adds */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-success mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Recent</div>
                        <div className="text-2xl font-bold text-success">{stats.recentAdds.thisWeek}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            This week • {stats.recentAdds.thisMonth} this month
                        </div>
                    </div>

                    {/* Styles */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-info mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-8 h-8 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                            </svg>
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Styles</div>
                        <div className="text-2xl font-bold text-info">{Object.keys(stats.styleCounts).length}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.topStyle && `${stats.topStyle.name} (${stats.topStyle.count})`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollectionStats;
