import React from 'react';
import type { UpcomingRelease } from '../../types/discover.types';

interface UpcomingReleaseCardProps {
    release: UpcomingRelease;
}

const formatReleaseDate = (release: UpcomingRelease): string => {
    if (release.datePrecision === 'month') {
        const [year, month] = release.firstReleaseDate.split('-');
        return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
        });
    }
    return new Date(release.firstReleaseDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const UpcomingReleaseCard: React.FC<UpcomingReleaseCardProps> = ({ release }) => {
    return (
        <div className="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group">
            <figure className="aspect-square relative overflow-hidden rounded-t-xl">
                <img
                    src={release.coverArtUrl || '/placeholder-album.svg'}
                    alt={release.title}
                    loading="lazy"
                    className="object-cover w-full h-full opacity-0 transition-opacity duration-300"
                    onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/placeholder-album.svg';
                    }}
                />
            </figure>
            <div className="card-body p-2 gap-0.5">
                <h3 className="card-title text-xs leading-tight truncate block" title={release.title}>
                    {release.title}
                </h3>
                {release.primaryType === 'EP' && (
                    <span className="badge badge-outline badge-xs">EP</span>
                )}
                <p className="text-[10px] opacity-70 truncate block">{release.artist}</p>
                <p className="text-[9px] opacity-50 mt-0.5">{formatReleaseDate(release)}</p>
            </div>
        </div>
    );
};

export default UpcomingReleaseCard;
