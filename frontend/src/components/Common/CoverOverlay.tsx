import React from 'react';

interface CoverOverlayProps {
    /** Bottom-left. Already formatted: each surface dates its records differently. */
    date?: string | null;
    /** Tooltip for the date, to say what it dates. */
    dateTitle?: string;
    /** Bottom-right. The medium ("Vinyl", "CD") or the release kind ("EP"). */
    type?: string | null;
    /** Tooltip for the type, for when a long medium name gets clipped. */
    typeTitle?: string;
}

/**
 * The two corners every album tile shows over its sleeve.
 *
 * Four grids used to spell this out themselves and had drifted apart: different
 * corners, different badge sizes, one of them only visible on hover. Keeping it
 * in one place is what makes them agree.
 *
 * Meant to be dropped inside the `figure` that holds the cover, which must be
 * `relative`. Its z-indexes stay single-digit on purpose: the overlay only has
 * to beat the cover image, and anything higher paints over page-level dropdowns.
 * A host whose image sits above `z-3` has to come down, not the overlay up.
 */
const CoverOverlay: React.FC<CoverOverlayProps> = ({ date, dateTitle, type, typeTitle }) => {
    if (!date && !type) return null;

    return (
        <>
            {/* Readability scrim: white text on a pale sleeve is otherwise a coin toss. */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/70 to-transparent pointer-events-none z-2" />
            {date && (
                <span
                    className="absolute bottom-1 left-1.5 z-3 text-[10px] font-medium text-white drop-shadow-sm"
                    title={dateTitle}
                >
                    {date}
                </span>
            )}
            {type && (
                <span
                    className="absolute bottom-1 right-1.5 z-3 badge badge-xs max-w-[60%] truncate"
                    title={typeTitle}
                >
                    {type}
                </span>
            )}
        </>
    );
};

export default CoverOverlay;
