import axios from 'axios';

// ===== Types =====

export interface FoundAlbumInfo {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
}

// ===== Helpers =====

/**
 * Cleans an album title by removing the artist prefix.
 * Discogs returns titles in the format "Artist - Album Title"
 * This function removes everything before " - " to get just the album title.
 * Example: "Adept (4) - Death Dealers" -> "Death Dealers"
 */
function cleanAlbumTitle(title: string): string {
    const separator = ' - ';
    const separatorIndex = title.indexOf(separator);
    if (separatorIndex !== -1) {
        return title.substring(separatorIndex + separator.length).trim();
    }
    return title;
}

/** Rate limiting delay */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ===== Main Service =====

const DISCOGS_BASE_URL = 'https://api.discogs.com';
const HEADERS = { 'User-Agent': 'Musivault/1.0' };
const RATE_LIMIT_MS = 1500;

/**
 * Search Discogs for an album by artist and title.
 * Tries masters first (and fetches main_release ID), then falls back to releases.
 */
export async function searchByArtistAlbum(
    artist: string,
    title: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    console.log(`[Discogs] Searching for: "${artist}" - "${title}" (year: ${year || 'N/A'})`);

    if (!key || !secret) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    const authParams = { key, secret, q: `${artist} ${title}` };

    // Try masters first
    const masterResult = await searchMasters(authParams, artist, year);
    if (masterResult) return masterResult;

    // Fallback to releases
    const releaseResult = await searchReleases(authParams, artist, year);
    if (releaseResult) return releaseResult;

    console.log('[Discogs] No results found');
    return null;
}

async function searchMasters(
    authParams: Record<string, string>,
    artist: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    try {
        console.log('[Discogs] Trying masters...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: HEADERS,
            params: { ...authParams, type: 'master' }
        });

        let results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} masters`);

        // Filter by year if provided
        if (year?.trim()) {
            const filtered = results.filter(r => r.year?.toString() === year.trim());
            if (filtered.length) results = filtered;
        }

        if (!results.length) return null;

        const r = results[0];
        const cleanedTitle = cleanAlbumTitle(r.title);
        console.log(`[Discogs] Selected master: ${r.title} -> ${cleanedTitle} (ID: ${r.id})`);

        // Fetch main_release ID (required for album detail view)
        return await fetchMainRelease(r, authParams, artist, cleanedTitle);
    } catch (err: any) {
        console.log('[Discogs] Master search error:', err.message);
        return null;
    }
}

async function fetchMainRelease(
    master: any,
    authParams: Record<string, string>,
    artist: string,
    cleanedTitle: string
): Promise<FoundAlbumInfo> {
    try {
        await delay(RATE_LIMIT_MS);
        const response = await axios.get<{ main_release: number; images?: { uri: string }[] }>(
            `${DISCOGS_BASE_URL}/masters/${master.id}`,
            { headers: HEADERS, params: { key: authParams.key, secret: authParams.secret } }
        );

        const mainReleaseId = response.data.main_release;
        const coverImage = response.data.images?.[0]?.uri || master.cover_image || master.thumb || '';

        console.log(`[Discogs] Got main_release ID: ${mainReleaseId}`);
        return {
            discogsId: mainReleaseId,
            title: cleanedTitle,
            artist,
            year: master.year?.toString() || '',
            thumb: master.thumb || '',
            cover_image: coverImage
        };
    } catch (err: any) {
        console.log(`[Discogs] Failed to get main_release, using master ID: ${err.message}`);
        return {
            discogsId: master.id,
            title: cleanedTitle,
            artist,
            year: master.year?.toString() || '',
            thumb: master.thumb || '',
            cover_image: master.cover_image || master.thumb || ''
        };
    }
}

async function searchReleases(
    authParams: Record<string, string>,
    artist: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    try {
        console.log('[Discogs] Trying releases...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: HEADERS,
            params: { ...authParams, type: 'release' }
        });

        let results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} releases`);

        // Filter by year if provided
        if (year?.trim()) {
            const filtered = results.filter(r => r.year?.toString() === year.trim());
            if (filtered.length) results = filtered;
        }

        if (!results.length) return null;

        const r = results[0];
        const cleanedTitle = cleanAlbumTitle(r.title);
        console.log(`[Discogs] Selected release: ${r.title} -> ${cleanedTitle} (ID: ${r.id})`);

        return {
            discogsId: r.id,
            title: cleanedTitle,
            artist,
            year: r.year?.toString() || '',
            thumb: r.thumb || '',
            cover_image: r.cover_image || r.thumb || ''
        };
    } catch (err: any) {
        console.log('[Discogs] Release search error:', err.message);
        return null;
    }
}

export const discogsService = {
    searchByArtistAlbum
};
