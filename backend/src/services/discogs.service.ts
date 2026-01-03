/**
 * Discogs Service
 * Centralized service for all Discogs API interactions
 */

import axios from 'axios';
import {
    DiscogsSearchResultExtended,
    DiscogsMasterDetailsResponse,
    DiscogsMasterVersionsResponse,
    DiscogsReleaseResponse,
    DiscogsArtistResponse,
    DiscogsArtistReleasesResponse,
    CleanedSearchResult,
    CleanedReleaseDetails,
    CleanedMasterVersions,
    CleanedArtistReleases,
    FoundAlbumInfo
} from '../types/discogs.types';
import {
    DISCOGS_BASE_URL,
    DISCOGS_HEADERS,
    RATE_LIMIT_MS,
    getAuthParams,
    hasCredentials,
    delay,
    discogsRequest,
    cleanAlbumTitle,
    normalizeString,
    calculateSimilarity,
    artistMatches
} from '../utils/discogs.utils';

// ===== Search Functions (for Controller) =====

/**
 * Search for albums - combines masters and orphan releases
 */
export async function searchAlbums(query: string): Promise<CleanedSearchResult[]> {
    const auth = getAuthParams();
    const searchUrl = `${DISCOGS_BASE_URL}/database/search`;

    // Run both searches in parallel
    const [mastersResponse, releasesResponse] = await Promise.all([
        axios.get<{ results: DiscogsSearchResultExtended[] }>(searchUrl, {
            params: { q: query, type: 'master', key: auth.key, secret: auth.secret },
            headers: DISCOGS_HEADERS
        }),
        axios.get<{ results: DiscogsSearchResultExtended[] }>(searchUrl, {
            params: { q: query, type: 'release', key: auth.key, secret: auth.secret },
            headers: DISCOGS_HEADERS
        })
    ]);

    const masters = mastersResponse.data.results || [];
    const releases = releasesResponse.data.results || [];

    // Create set of master IDs
    const masterIds = new Set(masters.map(m => m.id));

    // Filter orphan releases (no master or master not in our results)
    const orphanReleases = releases.filter(r => !r.master_id || !masterIds.has(r.master_id));

    // Combine: masters first, then orphan releases
    return [
        ...masters.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: 'master' as const
        })),
        ...orphanReleases.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: 'release' as const
        }))
    ];
}

/**
 * Search for artists
 */
export async function searchArtists(query: string): Promise<{ id: number; name: string; thumb: string }[]> {
    const response = await discogsRequest<{ results: { id: number; title: string; thumb: string }[] }>(
        '/database/search',
        { q: query, type: 'artist' }
    );

    return response.results.map(item => ({
        id: item.id,
        name: item.title,
        thumb: item.thumb
    }));
}

/**
 * Search by barcode (UPC/EAN)
 */
export async function searchByBarcode(barcode: string): Promise<CleanedSearchResult[]> {
    const response = await discogsRequest<{ results: DiscogsSearchResultExtended[] }>(
        '/database/search',
        { barcode, type: 'release' }
    );

    return (response.results || []).map(item => ({
        id: item.id,
        title: item.title,
        year: item.year,
        thumb: item.thumb,
        type: 'release' as const
    }));
}

// ===== Detail Functions (for Controller) =====

/**
 * Get release details by ID
 */
export async function getReleaseDetails(releaseId: string): Promise<CleanedReleaseDetails> {
    const data = await discogsRequest<DiscogsReleaseResponse>(
        `/releases/${releaseId}`,
        {},
        { useTokenAuth: true }
    );

    return {
        discogsId: data.id,
        title: data.title,
        artist: data.artists?.map(a => a.name).join(', ') || 'Unknown artist',
        year: data.year,
        cover_image: data.images?.find(img => img.type === 'primary')?.uri || data.images?.[0]?.uri || '',
        styles: data.styles || [],
        availableFormats: data.formats?.map(f => ({
            name: f.name,
            descriptions: f.descriptions || [],
            text: f.text || ''
        })) || [],
        tracklist: data.tracklist?.map(t => ({
            position: t.position,
            title: t.title,
            duration: t.duration || '',
            artist: t.artists?.map(a => a.name).join(', ') || ''
        })) || [],
        labels: data.labels?.map(l => ({
            name: l.name,
            catno: l.catno || ''
        })) || []
    };
}

/**
 * Get master versions with format filtering and counts
 */
export async function getMasterVersions(masterId: string): Promise<CleanedMasterVersions> {
    const auth = getAuthParams();

    // Fetch details and versions in parallel
    const [detailsResponse, versionsResponse] = await Promise.all([
        axios.get<DiscogsMasterDetailsResponse>(`${DISCOGS_BASE_URL}/masters/${masterId}`, {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret }
        }),
        axios.get<DiscogsMasterVersionsResponse>(`${DISCOGS_BASE_URL}/masters/${masterId}/versions`, {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret }
        })
    ]);

    const versions = versionsResponse.data.versions || [];

    // Filter out digital-only versions
    const physicalVersions = versions.filter(version => {
        const formats = version.major_formats || [];
        const hasPhysical = formats.some((f: string) =>
            ['Vinyl', 'CD', 'Cassette', 'Box Set', 'All Media'].includes(f)
        );
        const isFileOnly = formats.includes('File') && !hasPhysical;
        return !isFileOnly;
    });

    // Calculate format counts
    const formatCounts: { [key: string]: number } = { CD: 0, Vinyl: 0, Cassette: 0 };
    physicalVersions.forEach(version => {
        if (version.major_formats.includes('Vinyl')) formatCounts.Vinyl++;
        if (version.major_formats.includes('CD')) formatCounts.CD++;
        if (version.major_formats.includes('Cassette')) formatCounts.Cassette++;
    });

    // Calculate country counts
    const countryCounts: { [key: string]: number } = {};
    physicalVersions.forEach(version => {
        const country = version.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    return {
        masterTitle: detailsResponse.data.title.split(' - ')[0],
        coverImage: detailsResponse.data.images?.[0]?.uri || '',
        main_release: detailsResponse.data.main_release,
        formatCounts,
        countryCounts,
        versions: physicalVersions.map(v => ({
            id: v.id,
            title: v.title,
            format: v.format,
            label: v.label,
            country: v.country,
            released: v.released,
            majorFormat: v.major_formats?.[0] || 'N/A'
        }))
    };
}

/**
 * Get artist releases/discography
 */
export async function getArtistReleases(
    artistId: string,
    sort: string = 'year',
    order: string = 'desc'
): Promise<CleanedArtistReleases> {
    const auth = getAuthParams();

    const [artistResponse, releasesResponse] = await Promise.all([
        axios.get<DiscogsArtistResponse>(`${DISCOGS_BASE_URL}/artists/${artistId}`, {
            params: { key: auth.key, secret: auth.secret },
            headers: DISCOGS_HEADERS
        }),
        axios.get<DiscogsArtistReleasesResponse>(`${DISCOGS_BASE_URL}/artists/${artistId}/releases`, {
            params: { key: auth.key, secret: auth.secret, per_page: 100, sort: 'year', sort_order: order },
            headers: DISCOGS_HEADERS
        })
    ]);

    const releases = releasesResponse.data.releases || [];

    // Filter to main albums only, excluding digital-only
    const albums = releases
        .filter(r => {
            if (r.role !== 'Main' || (r.type !== 'master' && r.type !== 'release')) {
                return false;
            }
            const format = r.format?.toLowerCase() || '';
            const isFileOnly = format === 'file' || (format.includes('file') && !format.match(/vinyl|cd|cassette|lp|box set/i));
            return !isFileOnly;
        })
        .map(r => ({
            id: r.type === 'master' ? r.id : (r.main_release || r.id),
            title: r.title,
            year: r.year || 0,
            thumb: r.thumb,
            type: r.type as 'master' | 'release'
        }));

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueAlbums = albums.filter(album => {
        const key = album.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort
    const sortedAlbums = [...uniqueAlbums].sort((a, b) => {
        if (sort === 'title') {
            const comparison = a.title.localeCompare(b.title);
            return order === 'asc' ? comparison : -comparison;
        }
        const comparison = a.year - b.year;
        return order === 'asc' ? comparison : -comparison;
    });

    return {
        artist: {
            id: artistId,
            name: artistResponse.data.name,
            image: artistResponse.data.images?.[0]?.uri || ''
        },
        albums: sortedAlbums
    };
}

// ===== Import Functions (for CSV Import Service) =====

/**
 * Score a result based on match quality
 */
function scoreResult(result: any, searchArtist: string, searchTitle: string, searchYear?: string): number {
    let score = 0;

    const cleanedTitle = cleanAlbumTitle(result.title || '');
    const titleSim = calculateSimilarity(searchTitle, cleanedTitle);
    score += titleSim * 50;

    const titlePrefix = result.title?.split(' - ')[0] || '';
    if (artistMatches(searchArtist, titlePrefix)) {
        score += 30;
    }

    if (searchYear && result.year?.toString() === searchYear.trim()) {
        score += 20;
    }

    return score;
}

/**
 * Search for album by artist and title (for CSV import)
 */
export async function searchByArtistAlbum(
    artist: string,
    title: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    console.log(`[Discogs] Searching for: "${artist}" - "${title}" (year: ${year || 'N/A'})`);

    if (!hasCredentials()) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    const auth = getAuthParams();
    const authParams = { key: auth.key, secret: auth.secret, artist, release_title: title };

    // Try masters first
    const masterResult = await searchMastersInternal(authParams, artist, title, year);
    if (masterResult) return masterResult;

    // Fallback to releases
    const releaseResult = await searchReleasesInternal(
        { key: auth.key, secret: auth.secret, q: `${artist} ${title}` },
        artist, title, year
    );
    if (releaseResult) return releaseResult;

    console.log('[Discogs] No results found');
    return null;
}

async function searchMastersInternal(
    authParams: Record<string, string>,
    searchArtist: string,
    searchTitle: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    try {
        console.log('[Discogs] Trying masters...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: DISCOGS_HEADERS,
            params: { ...authParams, type: 'master' }
        });

        const results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} masters`);

        if (!results.length) return null;

        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

        if (scored[0].score < 30) {
            console.log(`[Discogs] Best match score ${scored[0].score} too low, skipping`);
            return null;
        }

        const r = scored[0].result;
        const cleanedTitle = cleanAlbumTitle(r.title);
        console.log(`[Discogs] Selected master: ${r.title} -> ${cleanedTitle} (ID: ${r.id}, Score: ${scored[0].score})`);

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
            { headers: DISCOGS_HEADERS, params: { key: authParams.key, secret: authParams.secret } }
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

async function searchReleasesInternal(
    authParams: Record<string, string>,
    searchArtist: string,
    searchTitle: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    try {
        console.log('[Discogs] Trying releases...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: DISCOGS_HEADERS,
            params: { ...authParams, type: 'release' }
        });

        const results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} releases`);

        if (!results.length) return null;

        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

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
 * Fetch release by ID (for CSV import)
 */
export async function fetchByReleaseId(releaseId: string | number): Promise<FoundAlbumInfo | null> {
    console.log(`[Discogs] Direct lookup for release ID: ${releaseId}`);

    if (!hasCredentials()) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    try {
        await delay(RATE_LIMIT_MS);
        const auth = getAuthParams();

        const response = await axios.get<{
            id: number;
            title: string;
            artists: { name: string }[];
            year: number;
            thumb: string;
            images?: { uri: string }[];
            formats?: { name: string; descriptions?: string[] }[];
        }>(`${DISCOGS_BASE_URL}/releases/${releaseId}`, {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret }
        });

        const data = response.data;
        const artist = data.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
        const title = cleanAlbumTitle(data.title) || data.title;
        const coverImage = data.images?.[0]?.uri || data.thumb || '';

        let format: 'Vinyl' | 'CD' | undefined;
        if (data.formats?.length) {
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
 * Search by catalog number (for CSV import)
 */
export async function searchByCatalogNumber(
    catalogNumber: string,
    artist?: string,
    title?: string
): Promise<FoundAlbumInfo | null> {
    console.log(`[Discogs] Searching by catalog number: ${catalogNumber}`);

    if (!hasCredentials()) {
        console.log('[Discogs] ERROR: DISCOGS_KEY or DISCOGS_SECRET not set');
        return null;
    }

    try {
        await delay(RATE_LIMIT_MS);
        const auth = getAuthParams();

        const params: Record<string, string> = {
            key: auth.key,
            secret: auth.secret,
            catno: catalogNumber,
            type: 'release'
        };

        if (artist) {
            params.artist = artist;
        }

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: DISCOGS_HEADERS,
            params
        });

        const results = response.data.results || [];
        console.log(`[Discogs] Found ${results.length} results for catalog number ${catalogNumber}`);

        if (!results.length) return null;

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

// ===== Export for CSV Import Service =====

export const discogsService = {
    searchByArtistAlbum,
    fetchByReleaseId,
    searchByCatalogNumber
};
