/**
 * The results grid shared by every Discover listing. Kept in one place so the
 * breakpoints of the shop, concert and release grids can't drift apart.
 */
export const RESULTS_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch';

/** How many cards a Discover section previews before sending you to its full page. */
export const PREVIEW_COUNT = 6;

/**
 * Bounds of the radius slider, mirroring MIN/MAX_RADIUS_KM on the server.
 *
 * 300 km rather than something larger because Ticketmaster cannot page past its
 * 1000th result: a wider search would return a fraction of what exists and
 * present it as the whole list.
 */
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 300;
