import { Request, Response } from 'express';
import axios from 'axios';

interface DiscogsResult {
    id: number;
    thumb: string;
    cover_image: string;
    title: string;
    year: number;
}

interface DiscogsSearchResultExtended {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
    master_id?: number; // Present on releases that have a master
}

interface DiscogsFormat {
    name: string;
    qty: string;
    text?: string;
    descriptions?: string[];
}

interface DiscogsTrack {
    position: string;
    title: string;
    duration: string;
    artists?: { name: string }[];
}

interface DiscogsLabel {
    name: string;
    catno?: string;
}

interface DiscogsReleaseResponse {
    id: number;
    title: string;
    artists: { name: string }[];
    year: string;
    images: {
        type: string; uri: string
    }[];
    formats: DiscogsFormat[];
    styles?: string[];
    tracklist?: DiscogsTrack[];
    labels?: DiscogsLabel[];
}

interface DiscogsSearchResult {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
}

interface DiscogsSearchResultExtended {
    id: number;
    title: string;
    year: string;
    thumb: string;
    type: 'master' | 'release';
    master_id?: number; // Present on releases that have a master
}
interface DiscogsMasterVersionsResult {
    id: number; // This is the release_id
    title: string;
    format: string;
    label: string;
    country: string;
    year: string;
}

interface DiscogsMasterDetailsResponse {
    title: string;
    main_release?: number;
    images?: { uri: string }[];
    filter_facets?: { id: string; values: { value: string; count: number }[] }[];
}

interface DiscogsVersion {
    id: number;
    title: string;
    format: string; // Detailed format for later use
    label: string;
    country: string;
    released: string; // Release year
    major_formats: string[]; // Main format (e.g., "Vinyl")
}

interface DiscogsMasterVersionsResponse {
    versions: {
        major_formats: any;
        released: any;
        id: number;
        title: string;
        format: string;
        label: string;
        country: string;
        year: string;
    }[];
}

export async function searchAlbums(req: Request, res: Response) {
    try {
        const { q } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!q) {
            res.status(400).json({ message: "Missing search parameter 'q'." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;
        const authParams = {
            q: q,
            key: discogsKey,
            secret: discogsSecret
        };
        const headers = { 'User-Agent': 'Musivault/1.0' };

        // 1. Run both searches in parallel
        const [mastersResponse, releasesResponse] = await Promise.all([
            axios.get<{ results: DiscogsSearchResultExtended[] }>(discogsApiUrl, {
                params: { ...authParams, type: 'master' },
                headers
            }),
            axios.get<{ results: DiscogsSearchResultExtended[] }>(discogsApiUrl, {
                params: { ...authParams, type: 'release' },
                headers
            })
        ]);

        const masters = mastersResponse.data.results || [];
        const releases = releasesResponse.data.results || [];

        // 2. Create a Set of found master IDs
        const masterIds = new Set(masters.map(m => m.id));

        // 3. Filter orphan releases (without master or master not in our results)
        const orphanReleases = releases.filter(r => !r.master_id || !masterIds.has(r.master_id));

        // 4. Combine: masters first, then orphan releases
        const combined = [
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

        res.status(200).json(combined);

    } catch (error) {
        console.error("Error searching albums on Discogs:", error);
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            res.status(429).json({ message: "Too many requests! Please wait about 30 seconds before trying again." });
            return;
        }
        res.status(500).json({ message: "Search failed." });
    }
}

export async function searchMasters(req: Request, res: Response) {
    try {
        const { q } = req.query; // Search term comes from query parameters

        if (!q) {
            res.status(400).json({ message: "Missing search parameter 'q'." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;

        const response = await axios.get<{ results: DiscogsSearchResult[] }>(discogsApiUrl, {
            params: {
                q: q,
                type: 'master',
                key: process.env.DISCOGS_KEY,
                secret: process.env.DISCOGS_SECRET,
            },
            headers: {
                'User-Agent': 'Musivault/1.0'
            }
        });

        // Clean results to return only essential data
        const cleanedResults = response.data.results.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
        }));

        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Error searching masters on Discogs:", error);
        res.status(500).json({ message: "Search failed." });
    }
}

export async function getMasterVersions(req: Request, res: Response) {
    try {
        const { masterId } = req.params;
        // Get key and secret from environment variables
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error: missing Discogs key or secret." });
            return;
        }

        const masterDetailsUrl = `https://api.discogs.com/masters/${masterId}`;
        const masterVersionsUrl = `https://api.discogs.com/masters/${masterId}/versions`;

        // Authentication via query parameters
        const authParams = {
            key: discogsKey,
            secret: discogsSecret
        };

        // Run both API calls in parallel to save time
        const [detailsResponse, versionsResponse] = await Promise.all([
            axios.get<DiscogsMasterDetailsResponse>(masterDetailsUrl, {
                headers: { 'User-Agent': 'Musivault/1.0' },
                params: authParams
            }),
            axios.get<DiscogsMasterVersionsResponse>(masterVersionsUrl, {
                headers: { 'User-Agent': 'Musivault/1.0' },
                params: authParams
            })
        ]);

        const versions = versionsResponse.data.versions || [];

        // --- FILTER OUT DIGITAL/FILE FORMATS ---
        // Only keep physical formats (Vinyl, CD, Cassette, etc.)
        const filteredOut: { id: number; format: string; majorFormats: string[] }[] = [];
        const physicalVersions = versions.filter(version => {
            const formats = version.major_formats || [];
            // Exclude if it's File format and has no physical format
            const hasPhysical = formats.some((f: string) =>
                ['Vinyl', 'CD', 'Cassette', 'Box Set', 'All Media'].includes(f)
            );
            const isFileOnly = formats.includes('File') && !hasPhysical;
            if (isFileOnly) {
                filteredOut.push({ id: version.id, format: version.format, majorFormats: formats });
            }
            return !isFileOnly;
        });

        // Debug: Log filtered out versions
        if (filteredOut.length > 0) {
            console.log(`[Master ${masterId}] Filtered out ${filteredOut.length} digital-only versions:`, filteredOut);
        }

        // --- MANUAL COUNTING LOGIC ---
        // Calculate counts ourselves by iterating through the versions list.
        const formatCounts: { [key: string]: number } = { CD: 0, Vinyl: 0, Cassette: 0 };
        physicalVersions.forEach(version => {
            if (version.major_formats.includes('Vinyl')) {
                formatCounts.Vinyl++;
            }
            if (version.major_formats.includes('CD')) {
                formatCounts.CD++;
            }
            if (version.major_formats.includes('Cassette')) {
                formatCounts.Cassette++;
            }
        });

        // Count versions by country
        const countryCounts: { [key: string]: number } = {};
        physicalVersions.forEach(version => {
            const country = version.country || 'Unknown';
            countryCounts[country] = (countryCounts[country] || 0) + 1;
        });

        const finalResponse = {
            masterTitle: detailsResponse.data.title.split(' - ')[0],
            coverImage: detailsResponse.data.images?.[0]?.uri || '',
            main_release: detailsResponse.data.main_release,
            formatCounts: formatCounts,
            countryCounts: countryCounts,
            versions: physicalVersions.map(v => ({
                id: v.id,
                title: v.title,
                format: v.format, // Detailed format for the modal
                label: v.label,
                country: v.country,
                released: v.released, // Release year
                majorFormat: v.major_formats?.[0] || 'N/A', // Main format
            }))
        };

        res.status(200).json(finalResponse);

    } catch (error) {
        console.error(`Error fetching data for master ${req.params.masterId}:`, error);
        res.status(500).json({ message: "Failed to fetch data." });
    }
}

export async function searchDiscogs(req: Request, res: Response) {
    try {
        const { q } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!q) {
            res.status(400).json({ message: "Missing search parameter 'q'." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;

        const response = await axios.get<{ results: DiscogsSearchResult[] }>(discogsApiUrl, {
            params: {
                q: q,
                key: discogsKey,
                secret: discogsSecret
            },
            headers: { 'User-Agent': 'Musivault/1.0' },

        });

        // Clean results and ensure type is included
        const cleanedResults = response.data.results.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: item.type, // Pass type to frontend
        }));

        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Error searching Discogs:", error);
        res.status(500).json({ message: "Search failed." });
    }
}

// Search for artists
export async function searchArtists(req: Request, res: Response) {
    try {
        const { q } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!q) {
            res.status(400).json({ message: "Missing search parameter 'q'." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;

        const response = await axios.get<{ results: { id: number; title: string; thumb: string }[] }>(discogsApiUrl, {
            params: {
                q: q,
                type: 'artist',
                key: discogsKey,
                secret: discogsSecret
            },
            headers: { 'User-Agent': 'Musivault/1.0' }
        });

        const cleanedResults = response.data.results.map(item => ({
            id: item.id,
            name: item.title,
            thumb: item.thumb
        }));

        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Error searching artists on Discogs:", error);
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            res.status(429).json({ message: "Too many requests! Please wait about 30 seconds before trying again." });
            return;
        }
        res.status(500).json({ message: "Search failed." });
    }
}

// Get albums (releases) for an artist
export async function getArtistReleases(req: Request, res: Response) {
    try {
        const { artistId } = req.params;
        const { sort = 'year', order = 'desc' } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        // Get artist info
        const artistUrl = `https://api.discogs.com/artists/${artistId}`;
        const releasesUrl = `https://api.discogs.com/artists/${artistId}/releases`;

        const authParams = {
            key: discogsKey,
            secret: discogsSecret
        };
        const headers = { 'User-Agent': 'Musivault/1.0' };

        const [artistResponse, releasesResponse] = await Promise.all([
            axios.get<{ name: string; images?: { uri: string }[] }>(artistUrl, { params: authParams, headers }),
            axios.get<{ releases: { id: number; title: string; year: number; thumb: string; type: string; role: string; artist: string; main_release?: number; format?: string }[] }>(releasesUrl, {
                params: { ...authParams, per_page: 100, sort: 'year', sort_order: order },
                headers
            })
        ]);

        // Filter to keep only albums (type master or release with role "Main")
        // Also filter out File-only releases (digital downloads)
        const releases = releasesResponse.data.releases || [];
        const albums = releases
            .filter(r => {
                // Must be Main role and master/release type
                if (r.role !== 'Main' || (r.type !== 'master' && r.type !== 'release')) {
                    return false;
                }
                // Filter out File-only releases
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

        // Deduplicate by title (keep first, usually the master)
        const seen = new Set<string>();
        const uniqueAlbums = albums.filter(album => {
            const key = album.title.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort according to parameters
        const sortedAlbums = [...uniqueAlbums].sort((a, b) => {
            if (sort === 'title') {
                const comparison = a.title.localeCompare(b.title);
                return order === 'asc' ? comparison : -comparison;
            } else {
                // By year
                const comparison = a.year - b.year;
                return order === 'asc' ? comparison : -comparison;
            }
        });

        res.status(200).json({
            artist: {
                id: artistId,
                name: artistResponse.data.name,
                image: artistResponse.data.images?.[0]?.uri || ''
            },
            albums: sortedAlbums
        });

    } catch (error) {
        console.error(`Error fetching albums for artist ${req.params.artistId}:`, error);
        res.status(500).json({ message: "Failed to fetch albums." });
    }
}

export async function getReleaseDetails(req: Request, res: Response) {
    try {
        const { releaseId } = req.params;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsSecret) {
            console.error("DISCOGS_SECRET is not defined in environment variables.");
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/releases/${releaseId}`;

        const response = await axios.get<DiscogsReleaseResponse>(discogsApiUrl, {
            headers: {
                'Authorization': `Discogs token=${discogsSecret}`,
                'User-Agent': 'Musivault/1.0'
            }
        });

        const data = response.data;

        const cleanedData = {
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
        res.status(200).json(cleanedData);

    } catch (error) {
        console.error("Error fetching release details from Discogs:", error);
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            res.status(404).json({ message: "Release not found on Discogs." });
            return;
        }
        res.status(500).json({ message: "Failed to fetch release details." });
    }
}

/**
 * Search Discogs for releases matching a given barcode (UPC/EAN).
 */
export async function searchByBarcode(req: Request, res: Response) {
    try {
        const { barcode } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!barcode || typeof barcode !== 'string') {
            res.status(400).json({ message: "The 'barcode' query parameter is required." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Server configuration error." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;

        const response = await axios.get<{ results: DiscogsSearchResultExtended[] }>(discogsApiUrl, {
            params: {
                barcode: barcode,
                type: 'release',
                key: discogsKey,
                secret: discogsSecret
            },
            headers: { 'User-Agent': 'Musivault/1.0' }
        });

        const results = response.data.results || [];

        // Return relevant fields for the frontend
        const cleanedResults = results.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: 'release' as const
        }));

        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Error searching Discogs by barcode:", error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 429) {
                res.status(429).json({ message: "Too many requests! Please wait about 30 seconds before trying again." });
                return;
            }
            if (error.response?.status === 404) {
                res.status(200).json([]); // No results found
                return;
            }
        }
        res.status(500).json({ message: "Barcode search failed." });
    }
}

