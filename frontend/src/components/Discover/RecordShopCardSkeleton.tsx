import React from 'react';

interface RecordShopCardSkeletonProps {
    /** How many placeholder cards to render. */
    count?: number;
}

/**
 * Placeholder cards shown while shops are being fetched. Mirrors the real
 * card's layout so the grid doesn't jump when results land, and pulses so a
 * location or radius change reads as work in progress rather than a freeze.
 */
const RecordShopCardSkeleton: React.FC<RecordShopCardSkeletonProps> = ({ count = 6 }) => (
    <>
        {Array.from({ length: count }, (_, i) => (
            <div
                key={i}
                className="card bg-base-200 shadow-sm h-full animate-pulse"
                aria-hidden="true"
            >
                <div className="card-body p-4 gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="h-5 bg-base-300 rounded w-2/3" />
                        <div className="h-5 bg-base-300 rounded w-12 shrink-0" />
                    </div>
                    <div className="h-4 bg-base-300 rounded w-5/6 opacity-70" />
                    <div className="h-3 bg-base-300 rounded w-1/2 opacity-50" />
                    <div className="card-actions mt-auto pt-2">
                        <div className="h-8 bg-base-300 rounded w-28" />
                    </div>
                </div>
            </div>
        ))}
    </>
);

export default RecordShopCardSkeleton;
