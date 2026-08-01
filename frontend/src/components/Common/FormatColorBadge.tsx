import React from 'react';
import { getFormatButtonStyle } from '../../utils/formatColors';

interface FormatColorBadgeProps {
    text: string;
    descriptions?: string[];
    className?: string;
    title?: string;
}

/**
 * Badge for a format's color-coded text/description (see formatColors.ts).
 * DaisyUI's .badge sizes set a fixed height, which clips the background when
 * a long variant name (e.g. "Cloudy Red on Clear Vinyl") wraps to 2 lines —
 * h-auto/whitespace-normal here let the background grow with the text instead.
 */
const FormatColorBadge: React.FC<FormatColorBadgeProps> = ({ text, descriptions = [], className = '', title }) => (
    <span
        className={`badge border h-auto whitespace-normal text-center leading-snug ${className}`.trim()}
        style={getFormatButtonStyle(text, descriptions)}
        title={title}
    >
        {text}
    </span>
);

export default FormatColorBadge;
