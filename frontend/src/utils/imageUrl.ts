const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Formats an image URL for display.
 * - If the URL is absolute (starts with http), returns it as is.
 * - If the URL is relative (starts with /), prepends the API base URL.
 * - If the URL is empty/null, returns a placeholder.
 */
export const getImageUrl = (url: string | null | undefined): string => {
    if (!url) {
        return '/placeholder.png'; // Make sure you have a placeholder or handle this in component
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    if (url.startsWith('/uploads')) {
        return `${API_BASE_URL}${url}`;
    }

    return url;
};
