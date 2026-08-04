import React from 'react';
import { getFormatButtonStyle } from '../../utils/formatColors';

interface FormatColorBadgeProps {
    text: string;
    descriptions?: string[];
    className?: string;
    title?: string;
    /**
     * Clips the label past this many characters. Collection views pass the same
     * value so a badge is the same size everywhere, whatever the variant name.
     */
    maxChars?: number;
}

const truncate = (value: string, maxChars?: number): string =>
    maxChars && value.length > maxChars
        ? `${value.slice(0, maxChars - 1).trimEnd()}…`
        : value;

/**
 * Badge for a format's color-coded text/description (see formatColors.ts).
 * Variant names run long — "Olive Green and Sea Blue Pinwheel with White
 * Splatter" — so callers cap them with maxChars and keep the full name in the
 * tooltip; the label stays on one line to keep rows an even height.
 */
const FormatColorBadge: React.FC<FormatColorBadgeProps> = ({ text, descriptions = [], className = '', title, maxChars }) => {
    const label = truncate(text, maxChars);

    return (
        <span
            className={`badge border h-auto whitespace-nowrap text-center leading-snug ${className}`.trim()}
            style={getFormatButtonStyle(text, descriptions)}
            title={title ?? (label !== text ? text : undefined)}
        >
            {label}
        </span>
    );
};

export default FormatColorBadge;
