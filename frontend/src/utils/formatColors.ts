/**
 * Extracts a CSS color from a format's text/descriptions based on known color keywords.
 * Returns a subtle background color string or null if no color is detected.
 */

const COLOR_MAP: Record<string, string> = {
    // Reds
    'red': '#e53e3e',
    'ruby': '#9b2335',
    'burgundy': '#800020',
    'maroon': '#800000',
    'crimson': '#dc143c',
    'cherry': '#de3163',
    'blood': '#8b0000',
    'rose': '#ff007f',
    'magenta': '#ff00ff',
    'pink': '#ec4899',
    'hot pink': '#ff69b4',

    // Oranges
    'orange': '#ed8936',
    'amber': '#f59e0b',
    'tangerine': '#ff9966',
    'peach': '#ffbe98',
    'copper': '#b87333',

    // Yellows
    'yellow': '#ecc94b',
    'gold': '#d69e2e',
    'golden': '#d69e2e',
    'cream': '#fffdd0',
    'mustard': '#e1ad01',

    // Greens
    'green': '#38a169',
    'olive': '#808000',
    'mint': '#3eb489',
    'emerald': '#50c878',
    'forest': '#228b22',
    'lime': '#84cc16',
    'sage': '#87ae73',
    'teal': '#319795',
    'sea glass': '#2dd4bf',
    'seafoam': '#71eeb8',
    'coke bottle': '#2f6b55',
    'jade': '#00a86b',
    'moss': '#8a9a5b',
    'army green': '#4b5320',
    'neon green': '#39ff14',

    // Blues
    'blue': '#3182ce',
    'navy': '#001f3f',
    'cobalt': '#0047ab',
    'royal blue': '#4169e1',
    'sky blue': '#87ceeb',
    'baby blue': '#89cff0',
    'cyan': '#00bcd4',
    'turquoise': '#40e0d0',
    'aqua': '#00ffff',
    'midnight': '#191970',
    'electric blue': '#7df9ff',

    // Purples
    'purple': '#805ad5',
    'violet': '#7c3aed',
    'lavender': '#b794f4',
    'lilac': '#c8a2c8',
    'plum': '#8e4585',
    'grape': '#6f2da8',
    'orchid': '#da70d6',
    'mauve': '#e0b0ff',
    'indigo': '#4b0082',

    // Browns
    'brown': '#8b6914',
    'bronze': '#cd7f32',
    'tan': '#d2b48c',
    'chocolate': '#7b3f00',
    'cinnamon': '#d2691e',
    'caramel': '#ffddaf',
    'coffee': '#6f4e37',
    'walnut': '#773f1a',
    'mahogany': '#c04000',

    // Neutrals
    'black': '#808080',
    'white': '#f0f0f0',
    'grey': '#718096',
    'gray': '#718096',
    'silver': '#c0c0c0',
    'smoke': '#96969c',
    'bone': '#e3dac9',
    'ivory': '#fffff0',
    'milky': '#fdfff5',

    // Special
    'clear': '#a0d2db',
    'transparent': '#a0d2db',
    'splatter': null as unknown as string, // skip, use other color
    'marble': null as unknown as string,
    'swirl': null as unknown as string,
    'haze': null as unknown as string,
    'galaxy': '#2d1b69',
    'sunset': '#f97316',
    'fire': '#ef4444',
    'ice': '#bae6fd',
    'neon': '#c6f135',
};

// Sorted by length descending so "sea glass" matches before "sea" or "glass"
const SORTED_KEYWORDS = Object.entries(COLOR_MAP)
    .filter(([, color]) => color !== null)
    .sort(([a], [b]) => b.length - a.length);

/**
 * Extracts all matching colors from the format text/descriptions.
 * Returns an array of unique hex colors.
 */
export function extractFormatColors(text?: string, descriptions?: string[]): string[] {
    const combined = [text || '', ...(descriptions || [])].join(' ').toLowerCase();
    if (!combined.trim()) return [];

    const found: string[] = [];
    const seen = new Set<string>();
    // Track which parts of the string have been matched to avoid overlaps
    let remaining = combined;

    for (const [keyword, color] of SORTED_KEYWORDS) {
        if (remaining.includes(keyword)) {
            if (!seen.has(color)) {
                found.push(color);
                seen.add(color);
            }
            // Remove matched keyword to avoid sub-matches (e.g. "royal blue" → don't also match "blue")
            remaining = remaining.replace(keyword, ' ');
        }
    }

    return found;
}

/**
 * Returns inline styles for a button based on extracted colors.
 * Single color: subtle tint. Multiple colors: diagonal gradient.
 */
export function getFormatButtonStyle(text?: string, descriptions?: string[]): React.CSSProperties {
    const colors = extractFormatColors(text, descriptions);
    if (colors.length === 0) return {};

    if (colors.length === 1) {
        return {
            backgroundColor: `${colors[0]}20`,
            borderColor: `${colors[0]}60`,
            color: colors[0],
        };
    }

    // Multiple colors → diagonal gradient
    const gradientStops = colors.map((c, i) => {
        const start = (i / colors.length) * 100;
        const end = ((i + 1) / colors.length) * 100;
        return `${c}30 ${start}%, ${c}30 ${end}%`;
    }).join(', ');

    return {
        background: `linear-gradient(135deg, ${gradientStops})`,
        borderImage: `linear-gradient(135deg, ${colors.map((c, i) => `${c}70 ${(i / colors.length) * 100}%`).concat(`${colors[colors.length - 1]}70 100%`).join(', ')}) 1`,
        color: colors[0],
    };
}
