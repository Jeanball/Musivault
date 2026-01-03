import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Disc, Layers, Calendar, Clock, Tag, ChevronDown } from 'lucide-react';
import type { CollectionStats as CollectionStatsType } from '../../types/collection';

interface CollectionStatsProps {
    stats: CollectionStatsType;
}

const CollectionStats: React.FC<CollectionStatsProps> = ({ stats }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-base-100 rounded-box shadow-lg mb-4">
            {/* Header with toggle button */}
            <div
                className="flex flex-col items-center justify-center p-3 md:p-4 cursor-pointer hover:bg-base-200 rounded-t-box gap-2"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 md:gap-3">
                    <h3 className="font-semibold text-base md:text-lg">{t('stats.title')}</h3>
                    <ChevronDown
                        size={20}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
                <div className="flex flex-wrapjustify-center gap-x-3 gap-y-1 text-xs md:text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Disc size={14} /> {stats.total}</span>
                    <span className="flex items-center gap-1"><Layers size={14} /> {Object.keys(stats.formatCounts).length}</span>
                    <span className="flex items-center gap-1"><Calendar size={14} /> {Object.keys(stats.decadeCounts).length}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {stats.recentAdds.thisWeek}</span>
                    <span className="flex items-center gap-1"><Tag size={14} /> {Object.keys(stats.styleCounts).length}</span>
                </div>
            </div>

            {/* Collapsible content */}
            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
                    {/* Total */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-primary mb-2 flex justify-center">
                            <Disc size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.total')}</div>
                        <div className="text-2xl font-bold text-primary">{stats.total}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {stats.topArtist && `${stats.topArtist.name} (${stats.topArtist.count})`}
                        </div>
                    </div>

                    {/* Formats */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-secondary mb-2 flex justify-center">
                            <Layers size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('common.formats')}</div>
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
                        <div className="text-accent mb-2 flex justify-center">
                            <Calendar size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.decades')}</div>
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
                        <div className="text-success mb-2 flex justify-center">
                            <Clock size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.recent')}</div>
                        <div className="text-2xl font-bold text-success">{stats.recentAdds.thisWeek}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {t('stats.thisWeek')} • {stats.recentAdds.thisMonth} {t('stats.thisMonth')}
                        </div>
                    </div>

                    {/* Styles */}
                    <div className="bg-base-200 rounded-lg p-4 text-center">
                        <div className="text-info mb-2 flex justify-center">
                            <Tag size={32} />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">{t('stats.styles')}</div>
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
