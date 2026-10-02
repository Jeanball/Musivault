import React from 'react';

interface IconProps {
    className?: string;
}

/**
 * The search field's own icon set. Drawn on the same 24px grid with a 2px round
 * stroke so the magnifier, the scan frame and the cross read as one family
 * inside the bar.
 */

export const SearchGlassIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" aria-hidden="true"
    >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
);

/** A viewfinder rather than a camera: it frames a barcode, it doesn't take a photo. */
export const ScanFrameIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
        <path d="M3 8V5a2 2 0 0 1 2-2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
);

export const CrossIcon: React.FC<IconProps> = ({ className }) => (
    <svg
        className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);
