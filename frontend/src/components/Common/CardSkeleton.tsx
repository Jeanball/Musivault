import React from 'react';

interface CardSkeletonProps {
    /** How many placeholder cards to render. */
    count?: number;
    /** `media` adds the poster block used by cards that lead with an image. */
    variant?: 'compact' | 'media';
}

/**
 * Placeholder cards shown while a nearby search is in flight. Mirrors the real
 * cards' layout so the grid doesn't jump when results land, and pulses so a
 * location or radius change reads as work in progress rather than a freeze.
 */
const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 6, variant = 'compact' }) => (
    <>
        {Array.from({ length: count }, (_, i) => (
            <div
                key={i}
                className="card bg-base-200 shadow-xs h-full animate-pulse overflow-hidden"
                aria-hidden="true"
            >
                {variant === 'media' && <div className="h-40 bg-base-300" />}
                <div className="card-body p-4 gap-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="h-5 bg-base-300 rounded-sm w-2/3" />
                        <div className="h-5 bg-base-300 rounded-sm w-12 shrink-0" />
                    </div>
                    <div className="h-4 bg-base-300 rounded-sm w-5/6 opacity-70" />
                    <div className="h-3 bg-base-300 rounded-sm w-1/2 opacity-50" />
                    <div className="card-actions mt-auto pt-2">
                        <div className="h-8 bg-base-300 rounded-sm w-28" />
                    </div>
                </div>
            </div>
        ))}
    </>
);

export default CardSkeleton;
