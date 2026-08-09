/**
 * Covers fade in on `onLoad`, but an image served straight from the browser
 * cache can already be complete by the time React attaches the handler — the
 * event never fires and the tile stays blank. Reveal those immediately.
 *
 * Use as a ref on any `<img>` that starts at `opacity-0`.
 */
export const revealIfCached = (img: HTMLImageElement | null): void => {
    if (img?.complete && img.naturalWidth > 0) {
        img.classList.remove('opacity-0');
    }
};
