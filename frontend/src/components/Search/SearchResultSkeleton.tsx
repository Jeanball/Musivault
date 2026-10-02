import React from 'react';

/**
 * Stands in for a result row while the request is in flight. It mirrors the real
 * row's geometry so the list doesn't jump when the data lands, and it replaces
 * the previous results, which used to stay clickable while already stale.
 */
const SearchResultSkeleton: React.FC = () => (
    <div className="flex items-center gap-3 py-2 border-b border-base-300 sm:p-3 sm:border-0 sm:rounded-box sm:bg-base-200" aria-hidden="true">
        <div className="skeleton w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-field"></div>
        <div className="grow min-w-0 space-y-2">
            <div className="skeleton h-4 w-2/5"></div>
            <div className="skeleton h-3 w-1/4"></div>
            <div className="flex gap-1">
                <div className="skeleton h-4 w-12"></div>
                <div className="skeleton h-4 w-20"></div>
            </div>
        </div>
    </div>
);

export default SearchResultSkeleton;
