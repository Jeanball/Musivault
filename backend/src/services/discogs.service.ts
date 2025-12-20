import axios from 'axios';

// ===== Types =====

export interface FoundAlbumInfo {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
    format?: 'Vinyl' | 'CD';
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

/**
 * Normalize a string for comparison: lowercase, remove special chars, extra spaces
 */
function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ')     // Normalize spaces
        .trim();
}

/**
 * Calculate similarity between two strings (0-1 score)
 * Uses a simple approach: what percentage of words from str1 are in str2
 */
function calculateSimilarity(str1: string, str2: string): number {
    const norm1 = normalizeString(str1);
    const norm2 = normalizeString(str2);

    if (norm1 === norm2) return 1;
    if (!norm1 || !norm2) return 0;

    const words1 = norm1.split(' ');
    const words2Set = new Set(norm2.split(' '));

    let matches = 0;
    for (const word of words1) {
        if (words2Set.has(word)) matches++;
    }

    return matches / words1.length;
}

/**
 * Check if an artist name matches (handles variations like "Artist (2)")
 */
function artistMatches(searchArtist: string, resultArtist: string): boolean {
    const normSearch = normalizeString(searchArtist);
    const normResult = normalizeString(resultArtist.replace(/\(\d+\)/g, '')); // Remove (2), (3) etc.

    return normResult.includes(normSearch) || normSearch.includes(normResult) ||
        calculateSimilarity(normSearch, normResult) >= 0.8;
}

/**
 * Score a Discogs result based on how well it matches the search criteria
 */
function scoreResult(result: any, searchArtist: string, searchTitle: string, searchYear?: string): number {
    let score = 0;

    // Title match (from Discogs format "Artist - Title")
    const cleanedTitle = cleanAlbumTitle(result.title || '');
    const titleSim = calculateSimilarity(searchTitle, cleanedTitle);
    score += titleSim * 50; // Max 50 points for title

    // Artist match - check in title prefix or artist field
    const titlePrefix = result.title?.split(' - ')[0] || '';
    if (artistMatches(searchArtist, titlePrefix)) {
        score += 30;
    }

    // Year match (bonus points)
    if (searchYear && result.year?.toString() === searchYear.trim()) {
        score += 20;
    }

    return score;
}

// ===== Main Service =====

const DISCOGS_BASE_URL = 'https://api.discogs.com';
const HEADERS = { 'User-Agent': 'Musivault/1.0' };
const RATE_LIMIT_MS = 1100;

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

    // Use separate artist and release_title params for better matching
    const authParams = { key, secret, artist, release_title: title };

    // Try masters first
    const masterResult = await searchMasters(authParams, artist, title, year);
    if (masterResult) return masterResult;

    // Fallback to releases with combined query
    const releaseResult = await searchReleases({ key, secret, q: `${artist} ${title}` }, artist, title, year);
    if (releaseResult) return releaseResult;

    console.log('[Discogs] No results found');
    return null;
}

async function searchMasters(
    authParams: Record<string, string>,
    searchArtist: string,
    searchTitle: string,
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

        if (!results.length) return null;

        // Score all results and pick the best match
        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

        // Require minimum score of 30 (at least artist match)
        if (scored[0].score < 30) {
            console.log(`[Discogs] Best match score ${scored[0].score} too low, skipping`);
            return null;
        }

        const r = scored[0].result;
        const cleanedTitle = cleanAlbumTitle(r.title);
        console.log(`[Discogs] Selected master: ${r.title} -> ${cleanedTitle} (ID: ${r.id}, Score: ${scored[0].score})`);

        // Fetch main_release ID (required for album detail view)
        return await fetchMainRelease(r, authParams, searchArtist, cleanedTitle);
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
    searchArtist: string,
    searchTitle: string,
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

        if (!results.length) return null;

        // Score all results and pick the best match
        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

        // Require minimum score of 30 (at least artist match)
        if (scored[0].score < 30) {
            console.log(`[Discogs] Best match score ${scored[0].score} too low, skipping`);
            return null;
        }

        const r = scored[0].result;
        const cleanedTitle = cleanAlbumTitle(r.title);
        console.log(`[Discogs] Selected release: ${r.title} -> ${cleanedTitle} (ID: ${r.id}, Score: ${scored[0].score})`);

        return {
            discogsId: r.id,
            title: cleanedTitle,
            artist: searchArtist,
            year: r.year?.toString() || '',
            thumb: r.thumb || '',
            cover_image: r.cover_image || r.thumb || ''
        };
    } catch (err: any) {
        console.log('[Discogs] Release search error:', err.message);
        return null;
    }
}

/**
 * Fetch a specific release by its Discogs release ID.
 * This is the most precise lookup method.
 */
export async function fetchByReleaseId(releaseId: string | number): Promise<FoundAlbumInfo | null> {
    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    console.log(`[Discogs] Direct lookup for release ID: ${releaseId}`);

    if (!key || !secret) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    try {
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{
            id: number;
            title: string;
            artists: { name: string }[];
            year: number;
            thumb: string;
            images?: { uri: string }[];
            formats?: { name: string; descriptions?: string[] }[];
        }>(`${DISCOGS_BASE_URL}/releases/${releaseId}`, {
            headers: HEADERS,
            params: { key, secret }
        });

        const data = response.data;
        const artist = data.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
        const title = cleanAlbumTitle(data.title) || data.title;
        const coverImage = data.images?.[0]?.uri || data.thumb || '';

        // Determine format from Discogs formats array
        let format: 'Vinyl' | 'CD' | undefined;
        if (data.formats && data.formats.length > 0) {
            const formatNames = data.formats.map(f => f.name.toLowerCase());
            if (formatNames.some(f => f.includes('vinyl') || f.includes('lp') || f.includes('12"') || f.includes('7"'))) {
                format = 'Vinyl';
            } else if (formatNames.some(f => f.includes('cd'))) {
                format = 'CD';
            }
        }

        console.log(`[Discogs] Found release: ${artist} - ${title} (ID: ${data.id}, Format: ${format || 'unknown'})`);

        return {
            discogsId: data.id,
            title,
            artist,
            year: data.year?.toString() || '',
            thumb: data.thumb || '',
            cover_image: coverImage,
            format
        };
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.log(`[Discogs] Release ID ${releaseId} not found`);
        } else {
            console.log('[Discogs] Fetch by release ID error:', err.message);
        }
        return null;
    }
}

/**
 * Search Discogs by catalog number.
 * This is useful when you have the label's catalog number (e.g., "CDNODATA29").
 */
export async function searchByCatalogNumber(
    catalogNumber: string,
    artist?: string,
    title?: string
): Promise<FoundAlbumInfo | null> {
    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    console.log(`[Discogs] Searching by catalog number: ${catalogNumber}`);

    if (!key || !secret) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    try {
        await delay(RATE_LIMIT_MS);

        // Build search params - catno is a supported Discogs search parameter
        const params: Record<string, string> = {
            key,
            secret,
            catno: catalogNumber,
            type: 'release'
        };

        // Add artist if provided for better filtering
        if (artist) {
            params.artist = artist;
        }

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: HEADERS,
            params
        });

        const results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} results for catalog number ${catalogNumber}`);

        if (!results.length) {
            return null;
        }

        // If we have artist/title info, score and pick best match
        if (artist && title) {
            const scored = results.map(r => ({
                result: r,
                score: scoreResult(r, artist, title)
            }));
            scored.sort((a, b) => b.score - a.score);

            const best = scored[0].result;
            const cleanedTitle = cleanAlbumTitle(best.title);
            console.log(`[Discogs] Selected: ${best.title} (ID: ${best.id}, Score: ${scored[0].score})`);

            return {
                discogsId: best.id,
                title: cleanedTitle,
                artist,
                year: best.year?.toString() || '',
                thumb: best.thumb || '',
                cover_image: best.cover_image || best.thumb || ''
            };
        }

        // Otherwise just take the first result
        const first = results[0];
        const cleanedTitle = cleanAlbumTitle(first.title);
        const titleParts = first.title.split(' - ');
        const artistName = titleParts.length > 1 ? titleParts[0].replace(/\(\d+\)/g, '').trim() : 'Unknown Artist';

        console.log(`[Discogs] Selected first result: ${first.title} (ID: ${first.id})`);

        return {
            discogsId: first.id,
            title: cleanedTitle,
            artist: artistName,
            year: first.year?.toString() || '',
            thumb: first.thumb || '',
            cover_image: first.cover_image || first.thumb || ''
        };
    } catch (err: any) {
        console.log('[Discogs] Catalog number search error:', err.message);
        return null;
    }
}

export const discogsService = {
    searchByArtistAlbum,
    fetchByReleaseId,
    searchByCatalogNumber
};
