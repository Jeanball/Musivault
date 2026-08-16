/**
 * Discogs Service
 * Centralized service for all Discogs API interactions
 */

import axios from 'axios';
import {
    DiscogsSearchResultExtended,
    DiscogsMasterDetailsResponse,
    DiscogsMasterVersionsResponse,
    DiscogsVersion,
    DiscogsReleaseResponse,
    DiscogsLabelResponse,
    CleanedLabelInfo,
    DiscogsArtistResponse,
    DiscogsArtistRelease,
    DiscogsArtistReleasesResponse,
    DiscogsMasterSearchResponse,
    ArtistReleaseCategory,
    CleanedSearchResult,
    CleanedReleaseDetails,
    CleanedMasterVersions,
    CleanedArtistReleases,
    FoundAlbumInfo,
    MarketplaceStats
} from '../types/discogs.types';
import { getPriceTTLHours } from '../utils/price.utils';
import {
    DISCOGS_BASE_URL,
    DISCOGS_HEADERS,
    RATE_LIMIT_MS,
    getAuthParams,
    hasCredentials,
    hasPAT,
    delay,
    discogsRequest,
    cleanAlbumTitle,
    normalizeString,
    calculateSimilarity,
    artistMatches
} from '../utils/discogs.utils';
import { logger } from '../config/logger.config';

// ===== Search Functions (for Controller) =====

/**
 * Keeps the pressing details Discogs returns with every search hit so a result
 * can be judged in the list instead of only on its own page.
 */
function pressingDetails(item: DiscogsSearchResultExtended) {
    return {
        format: item.format || [],
        label: item.label?.[0] || '',
        country: item.country || '',
        catno: item.catno || ''
    };
}

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
            type: 'master' as const,
            ...pressingDetails(item)
        })),
        ...orphanReleases.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: 'release' as const,
            ...pressingDetails(item)
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
        type: 'release' as const,
        ...pressingDetails(item)
    }));
}

/**
 * Lookup by reference (Discogs ID or Catalog Number)
 * @param reference - The reference value to search
 * @param type - 'discogsId' for release ID lookup, 'catno' for catalog number search
 */
export async function lookupByReference(
    reference: string,
    type: 'discogsId' | 'catno' = 'discogsId'
): Promise<CleanedSearchResult[]> {
    const trimmed = reference.trim();

    if (type === 'discogsId') {
        // Lookup by Discogs Release ID
        const result = await fetchByReleaseId(trimmed);
        if (result) {
            return [{
                id: result.discogsId,
                title: `${result.artist} - ${result.title}`,
                year: result.year || '',
                thumb: result.thumb,
                type: 'release' as const
            }];
        }
        return [];
    } else {
        // Search by Catalog Number - may return multiple results
        const auth = getAuthParams();

        if (!hasCredentials()) {
            return [];
        }

        try {
            await delay(RATE_LIMIT_MS);

            const response = await axios.get<{ results: DiscogsSearchResultExtended[] }>(
                `${DISCOGS_BASE_URL}/database/search`,
                {
                    headers: DISCOGS_HEADERS,
                    params: {
                        key: auth.key,
                        secret: auth.secret,
                        catno: trimmed,
                        type: 'release'
                    }
                }
            );

            return (response.data.results || []).map(item => ({
                id: item.id,
                title: item.title,
                year: item.year,
                thumb: item.thumb,
                type: 'release' as const,
                ...pressingDetails(item)
            }));
        } catch (err: any) {
            logger.warn({ err }, '[Discogs] Catalog number lookup error');
            return [];
        }
    }
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
        master_id: data.master_id,
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
            discogsId: l.id,
            name: l.name,
            catno: l.catno || ''
        })) || []
    };
}

// ===== Labels =====

/**
 * A label's name and website change once in a lifetime, so the cache lasts a month:
 * in practice the process restarts (deploy) long before an entry expires. The TTL is
 * only there so a label that moves its domain eventually gets picked up.
 */
const LABEL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const labelCache = new Map<string, { info: CleanedLabelInfo | null; expiresAt: number }>();

/**
 * Hosts that are not the label's own website. Discogs stores socials, shops and
 * wikis in the same `urls` array, so we push them down instead of linking them
 * as "the official site".
 */
const NON_OFFICIAL_URL_HOSTS = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'youtube.com',
    'soundcloud.com', 'bandcamp.com', 'discogs.com', 'wikipedia.org',
    'myspace.com', 'last.fm', 'spotify.com', 'linktr.ee', 'tiktok.com',
    'apple.com', 'amazon.com', 'ebay.com', 'mixcloud.com', 'vk.com',
    'flickr.com', 'vimeo.com', 'residentadvisor.net', 'ra.co', 'juno.co.uk',
    // Wayback snapshots of a dead label site: still worth listing, but calling one
    // "the official site" would send people to a frozen copy of a defunct page.
    'archive.org', 'web.archive.org'
];

function isOfficialSite(url: string): boolean {
    try {
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        return !NON_OFFICIAL_URL_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
    } catch {
        return false;
    }
}

function cleanLabelInfo(data: DiscogsLabelResponse): CleanedLabelInfo {
    const urls = (data.urls || []).filter(u => /^https?:\/\//i.test(u));

    return {
        discogsId: data.id,
        name: data.name,
        profile: data.profile || '',
        officialUrl: urls.find(isOfficialSite) || '',
        urls,
        discogsUrl: data.uri || `https://www.discogs.com/label/${data.id}`,
        image: data.images?.find(img => img.type === 'primary')?.uri || data.images?.[0]?.uri || ''
    };
}

/**
 * Fetch a label by its Discogs id. Returns null when the label is unknown.
 */
export async function getLabelDetails(labelId: string | number): Promise<CleanedLabelInfo | null> {
    const cacheKey = `id:${labelId}`;
    const cached = labelCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.info;

    try {
        const data = await discogsRequest<DiscogsLabelResponse>(`/labels/${labelId}`);
        const info = cleanLabelInfo(data);
        labelCache.set(cacheKey, { info, expiresAt: Date.now() + LABEL_CACHE_TTL_MS });
        return info;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            labelCache.set(cacheKey, { info: null, expiresAt: Date.now() + LABEL_CACHE_TTL_MS });
            return null;
        }
        throw err;
    }
}

/**
 * Resolve a label from its name only. Used for albums saved before we started
 * storing the Discogs label id.
 */
export async function getLabelByName(name: string): Promise<CleanedLabelInfo | null> {
    const cacheKey = `name:${normalizeString(name)}`;
    const cached = labelCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.info;

    const auth = getAuthParams();
    const response = await axios.get<{ results: { id: number; title: string }[] }>(
        `${DISCOGS_BASE_URL}/database/search`,
        {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret, q: name, type: 'label', per_page: 5 }
        }
    );

    const results = response.data.results || [];
    const normalized = normalizeString(name);
    const match = results.find(r => normalizeString(r.title) === normalized) || results[0];

    const info = match ? await getLabelDetails(match.id) : null;
    labelCache.set(cacheKey, { info, expiresAt: Date.now() + LABEL_CACHE_TTL_MS });
    return info;
}

const VERSIONS_PER_PAGE = 100;
// Discogs allows 60 requests/min: fetch pages by small batches instead of all at once
const VERSIONS_PAGE_CONCURRENCY = 5;
const VERSIONS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const versionsCache = new Map<string, { versions: DiscogsVersion[]; expiresAt: number }>();

async function fetchVersionsPage(masterId: string, page: number): Promise<DiscogsMasterVersionsResponse> {
    const auth = getAuthParams();
    const { data } = await axios.get<DiscogsMasterVersionsResponse>(
        `${DISCOGS_BASE_URL}/masters/${masterId}/versions`,
        {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret, page, per_page: VERSIONS_PER_PAGE }
        }
    );
    return data;
}

/**
 * Get every version of a master, following Discogs pagination to the last page
 */
async function fetchAllVersions(masterId: string): Promise<DiscogsVersion[]> {
    const cached = versionsCache.get(masterId);
    if (cached && cached.expiresAt > Date.now()) return cached.versions;

    const first = await fetchVersionsPage(masterId, 1);
    const totalPages = first.pagination?.pages || 1;

    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const versions = [...(first.versions || [])];

    for (let i = 0; i < remaining.length; i += VERSIONS_PAGE_CONCURRENCY) {
        const batch = remaining.slice(i, i + VERSIONS_PAGE_CONCURRENCY);
        const pages = await Promise.all(batch.map(page => fetchVersionsPage(masterId, page)));
        pages.forEach(page => versions.push(...(page.versions || [])));
    }

    versionsCache.set(masterId, { versions, expiresAt: Date.now() + VERSIONS_CACHE_TTL_MS });
    return versions;
}

/**
 * Get master versions with format filtering and counts
 */
export async function getMasterVersions(masterId: string): Promise<CleanedMasterVersions> {
    const auth = getAuthParams();

    // Fetch details and versions in parallel
    const [detailsResponse, versions] = await Promise.all([
        axios.get<DiscogsMasterDetailsResponse>(`${DISCOGS_BASE_URL}/masters/${masterId}`, {
            headers: DISCOGS_HEADERS,
            params: { key: auth.key, secret: auth.secret }
        }),
        fetchAllVersions(masterId)
    ]);

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

const ARTIST_PAGE_CONCURRENCY = 5;
const ARTIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Holds the discography unsorted: sorting is cheap and belongs to the request. */
const artistCache = new Map<string, { data: CleanedArtistReleases; expiresAt: number }>();

async function fetchArtistReleasesPage(artistId: string, page: number): Promise<DiscogsArtistReleasesResponse> {
    const auth = getAuthParams();
    const { data } = await axios.get<DiscogsArtistReleasesResponse>(
        `${DISCOGS_BASE_URL}/artists/${artistId}/releases`,
        {
            params: { key: auth.key, secret: auth.secret, per_page: 100, page, sort: 'year', sort_order: 'desc' },
            headers: DISCOGS_HEADERS
        }
    );
    return data;
}

/** Every release credited to an artist, following Discogs pagination. */
async function fetchAllArtistReleases(artistId: string): Promise<DiscogsArtistRelease[]> {
    const first = await fetchArtistReleasesPage(artistId, 1);
    const totalPages = first.pagination?.pages || 1;

    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const releases = [...(first.releases || [])];

    for (let i = 0; i < remaining.length; i += ARTIST_PAGE_CONCURRENCY) {
        const batch = remaining.slice(i, i + ARTIST_PAGE_CONCURRENCY);
        const pages = await Promise.all(batch.map(page => fetchArtistReleasesPage(artistId, page)));
        pages.forEach(page => releases.push(...(page.releases || [])));
    }

    return releases;
}

/**
 * Masters credited to an artist, optionally narrowed to one format. Far
 * cheaper than the artist endpoint, and the only place a master's format is
 * exposed.
 */
async function searchMasters(artistName: string, format?: string): Promise<DiscogsSearchResultExtended[]> {
    const auth = getAuthParams();
    const results: DiscogsSearchResultExtended[] = [];

    const search = async (page: number) => {
        const { data } = await axios.get<DiscogsMasterSearchResponse>(`${DISCOGS_BASE_URL}/database/search`, {
            params: { key: auth.key, secret: auth.secret, type: 'master', artist: artistName, per_page: 100, page, format },
            headers: DISCOGS_HEADERS
        });
        results.push(...(data.results || []));
        return data.pagination?.pages || 1;
    };

    const totalPages = await search(1);
    const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    for (let i = 0; i < remaining.length; i += ARTIST_PAGE_CONCURRENCY) {
        await Promise.all(remaining.slice(i, i + ARTIST_PAGE_CONCURRENCY).map(search));
    }

    return results;
}

/**
 * Formats describing a complete record. Anything else, singles and derived
 * pressings included, is hidden behind the "show everything" filter.
 */
const ALBUM_FORMAT_KEYWORDS = ['album', 'ep', 'lp', 'mini-album', 'compilation', 'box set'];

function categorizeRelease(formats: string[]): ArtistReleaseCategory {
    // An unknown format stays visible: hiding a real album is worse than showing a single
    if (formats.length === 0) return 'album';
    return formats.some(f => ALBUM_FORMAT_KEYWORDS.includes(f.toLowerCase())) ? 'album' : 'other';
}

/**
 * Discogs indexes several masters for the same record: the canonical one, badly
 * entered duplicates and 2-in-1 packs. They have different ids, so only the
 * title tells them apart. Search ranks the canonical master first, hence the
 * first hit wins.
 */
function dedupeByTitle<T extends { title: string; category: ArtistReleaseCategory }>(albums: T[]): T[] {
    const seen = new Set<string>();
    return albums.filter(album => {
        const key = `${album.category}|${album.title.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * The whole discography, unsorted and cached. The artist endpoint is the only
 * trustworthy source of master ids: a master search by artist name also returns
 * badly entered duplicates and homonyms, whose pages then load empty. The
 * search is kept here purely as a format lookup table.
 */
async function fetchArtistDiscography(artistId: string): Promise<CleanedArtistReleases> {
    const cached = artistCache.get(artistId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const auth = getAuthParams();

    const [artistResponse, releases] = await Promise.all([
        axios.get<DiscogsArtistResponse>(`${DISCOGS_BASE_URL}/artists/${artistId}`, {
            params: { key: auth.key, secret: auth.secret },
            headers: DISCOGS_HEADERS
        }),
        fetchAllArtistReleases(artistId)
    ]);

    const masterFormats = new Map<number, string[]>();
    (await searchMasters(artistResponse.data.name)).forEach(result => {
        if (result.format?.length) masterFormats.set(result.id, result.format);
    });

    const albums = releases
        .filter(r => {
            if (r.role !== 'Main' || (r.type !== 'master' && r.type !== 'release')) {
                return false;
            }
            const format = r.format?.toLowerCase() || '';
            const isFileOnly = format === 'file' || (format.includes('file') && !format.match(/vinyl|cd|cassette|lp|box set/i));
            return !isFileOnly;
        })
        .map(r => {
            const formats = r.type === 'master'
                ? masterFormats.get(r.id) || []
                : (r.format || '').split(',').map(f => f.trim());
            return {
                id: r.type === 'master' ? r.id : (r.main_release || r.id),
                title: r.title,
                year: r.year || 0,
                thumb: r.thumb,
                type: r.type as 'master' | 'release',
                category: categorizeRelease(formats)
            };
        });

    const uniqueAlbums = dedupeByTitle(albums);

    const data: CleanedArtistReleases = {
        artist: {
            id: artistId,
            name: artistResponse.data.name,
            image: artistResponse.data.images?.[0]?.uri || ''
        },
        albums: uniqueAlbums
    };

    artistCache.set(artistId, { data, expiresAt: Date.now() + ARTIST_CACHE_TTL_MS });
    return data;
}

/**
 * Get an artist's discography, every credit included and categorised. The
 * caller decides what to show: splitting the fetch per scope only meant
 * crawling twice.
 */
export async function getArtistReleases(
    artistId: string,
    sort: string = 'year',
    order: string = 'desc'
): Promise<CleanedArtistReleases> {
    const { artist, albums } = await fetchArtistDiscography(artistId);

    const sortedAlbums = [...albums].sort((a, b) => {
        const comparison = sort === 'title'
            ? a.title.localeCompare(b.title)
            : a.year - b.year;
        return order === 'asc' ? comparison : -comparison;
    });

    return { artist, albums: sortedAlbums };
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
    logger.debug(`[Discogs] Searching for: "${artist}" - "${title}" (year: ${year || 'N/A'})`);

    if (!hasCredentials()) {
        logger.error('[Discogs] DISCOGS_KEY or DISCOGS_SECRET not set');
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

    logger.debug('[Discogs] No results found');
    return null;
}

async function searchMastersInternal(
    authParams: Record<string, string>,
    searchArtist: string,
    searchTitle: string,
    year?: string
): Promise<FoundAlbumInfo | null> {
    try {
        logger.debug('[Discogs] Trying masters...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: DISCOGS_HEADERS,
            params: { ...authParams, type: 'master' }
        });

        const results = response.data.results || [];
        logger.debug(`[Discogs] Found ${results.length} masters`);

        if (!results.length) return null;

        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

        if (scored[0].score < 30) {
            logger.debug(`[Discogs] Best match score ${scored[0].score} too low, skipping`);
            return null;
        }

        const r = scored[0].result;
        const cleanedTitle = cleanAlbumTitle(r.title);
        logger.debug(`[Discogs] Selected master: ${r.title} -> ${cleanedTitle} (ID: ${r.id}, Score: ${scored[0].score})`);

        return await fetchMainRelease(r, authParams, searchArtist, cleanedTitle);
    } catch (err: any) {
        logger.warn({ err }, '[Discogs] Master search error');
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

        logger.debug(`[Discogs] Got main_release ID: ${mainReleaseId}`);
        return {
            discogsId: mainReleaseId,
            title: cleanedTitle,
            artist,
            year: master.year?.toString() || '',
            thumb: master.thumb || '',
            cover_image: coverImage
        };
    } catch (err: any) {
        logger.warn({ err }, '[Discogs] Failed to get main_release, falling back to master ID');
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
        logger.debug('[Discogs] Trying releases...');
        await delay(RATE_LIMIT_MS);

        const response = await axios.get<{ results: any[] }>(`${DISCOGS_BASE_URL}/database/search`, {
            headers: DISCOGS_HEADERS,
            params: { ...authParams, type: 'release' }
        });

        const results = response.data.results || [];
        logger.debug(`[Discogs] Found ${results.length} releases`);

        if (!results.length) return null;

        const scored = results.map(r => ({
            result: r,
            score: scoreResult(r, searchArtist, searchTitle, year)
        }));
        scored.sort((a, b) => b.score - a.score);

        if (scored[0].score < 30) {
            logger.debug(`[Discogs] Best match score ${scored[0].score} too low, skipping`);
            return null;
        }

        const r = scored[0].result;
        const cleanedTitle = cleanAlbumTitle(r.title);
        logger.debug(`[Discogs] Selected release: ${r.title} -> ${cleanedTitle} (ID: ${r.id}, Score: ${scored[0].score})`);

        return {
            discogsId: r.id,
            title: cleanedTitle,
            artist: searchArtist,
            year: r.year?.toString() || '',
            thumb: r.thumb || '',
            cover_image: r.cover_image || r.thumb || ''
        };
    } catch (err: any) {
        logger.warn({ err }, '[Discogs] Release search error');
        return null;
    }
}

/**
 * Fetch release by ID (for CSV import)
 */
export async function fetchByReleaseId(releaseId: string | number): Promise<FoundAlbumInfo | null> {
    logger.debug(`[Discogs] Direct lookup for release ID: ${releaseId}`);

    if (!hasCredentials()) {
        logger.error('[Discogs] DISCOGS_KEY or DISCOGS_SECRET not set');
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

        logger.debug(`[Discogs] Found release: ${artist} - ${title} (ID: ${data.id}, Format: ${format || 'unknown'})`);

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
            logger.debug(`[Discogs] Release ID ${releaseId} not found`);
        } else {
            logger.warn({ err }, '[Discogs] Fetch by release ID error');
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
    logger.debug(`[Discogs] Searching by catalog number: ${catalogNumber}`);

    if (!hasCredentials()) {
        logger.error('[Discogs] DISCOGS_KEY or DISCOGS_SECRET not set');
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
        logger.debug(`[Discogs] Found ${results.length} results for catalog number ${catalogNumber}`);

        if (!results.length) return null;

        if (artist && title) {
            const scored = results.map(r => ({
                result: r,
                score: scoreResult(r, artist, title)
            }));
            scored.sort((a, b) => b.score - a.score);

            const best = scored[0].result;
            const cleanedTitle = cleanAlbumTitle(best.title);
            logger.debug(`[Discogs] Selected: ${best.title} (ID: ${best.id}, Score: ${scored[0].score})`);

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

        logger.debug(`[Discogs] Selected first result: ${first.title} (ID: ${first.id})`);

        return {
            discogsId: first.id,
            title: cleanedTitle,
            artist: artistName,
            year: first.year?.toString() || '',
            thumb: first.thumb || '',
            cover_image: first.cover_image || first.thumb || ''
        };
    } catch (err: any) {
        logger.warn({ err }, '[Discogs] Catalog number search error');
        return null;
    }
}

// ===== Marketplace / Pricing =====

/**
 * Prices move, so this cache only exists to stop the same release being priced
 * twice in a row: once when the add modal opens, once when the add is confirmed.
 * It follows the same freshness rule as the prices stored on collection items.
 * A missing suggestion expires sooner, so an absence never sticks for a week.
 */
const priceCache = new Map<number, { stats: MarketplaceStats | null; expiresAt: number }>();
const NO_PRICE_CACHE_TTL_MS = 60 * 60 * 1000;

function cachePriceSuggestions(releaseId: number, stats: MarketplaceStats | null): MarketplaceStats | null {
    const ttlMs = stats ? getPriceTTLHours() * 60 * 60 * 1000 : NO_PRICE_CACHE_TTL_MS;
    priceCache.set(releaseId, { stats, expiresAt: Date.now() + ttlMs });
    return stats;
}

/**
 * Get price suggestions per condition grade for a release
 * Requires DISCOGS_PAT (Personal Access Token)
 * The user must have a Discogs seller account for this to work
 * Pass forceRefresh for the explicit sync paths, which must hit Discogs.
 */
export async function getMarketplaceStats(
    releaseId: number,
    { forceRefresh = false }: { forceRefresh?: boolean } = {}
): Promise<MarketplaceStats | null> {
    if (!hasPAT()) {
        return null;
    }

    const cached = priceCache.get(releaseId);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.stats;

    try {
        await delay(RATE_LIMIT_MS);

        const suggestions = await discogsRequest<Record<string, { value: number; currency: string }>>(
            `/marketplace/price_suggestions/${releaseId}`,
            {},
            { useTokenAuth: true }
        );

        // If empty response, no data available
        if (!suggestions || Object.keys(suggestions).length === 0) {
            return cachePriceSuggestions(releaseId, null);
        }

        const currency = Object.values(suggestions)[0]?.currency || 'USD';

        return cachePriceSuggestions(releaseId, {
            mint: suggestions['Mint (M)']?.value ?? null,
            nearMint: suggestions['Near Mint (NM or M-)']?.value ?? null,
            veryGoodPlus: suggestions['Very Good Plus (VG+)']?.value ?? null,
            veryGood: suggestions['Very Good (VG)']?.value ?? null,
            goodPlus: suggestions['Good Plus (G+)']?.value ?? null,
            good: suggestions['Good (G)']?.value ?? null,
            fair: suggestions['Fair (F)']?.value ?? null,
            poor: suggestions['Poor (P)']?.value ?? null,
            currency,
        });
    } catch (err: any) {
        logger.warn({ err }, `[Discogs] Price suggestions error for release ${releaseId}`);
        return null;
    }
}

// ===== Export for CSV Import Service =====

export const discogsService = {
    searchByArtistAlbum,
    fetchByReleaseId,
    searchByCatalogNumber
};
