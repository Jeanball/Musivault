/**
 * Formats an image URL for display.
 * - If the URL is absolute (starts with http), returns it as is.
 * - If the URL is empty/null, returns a placeholder.
 * - Otherwise returns it unchanged: /uploads is served same-origin, proxied by
 *   nginx in production and by the Vite dev server locally.
 */
export const getImageUrl = (url: string | null | undefined): string => {
    if (!url) {
        return '/placeholder.png'; // Make sure you have a placeholder or handle this in component
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    return url;
};
