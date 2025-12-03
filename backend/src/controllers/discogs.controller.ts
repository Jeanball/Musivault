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
    master_id?: number; // Présent sur les releases qui ont un master
}

interface DiscogsFormat {
    name: string;
    qty: string;
    text?: string;
    descriptions?: string[];
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
    master_id?: number; // Présent sur les releases qui ont un master
}
interface DiscogsMasterVersionsResult {
    id: number; // C'est le release_id
    title: string;
    format: string;
    label: string;
    country: string;
    year: string;
}

interface DiscogsMasterDetailsResponse {
    title: string;
    images?: { uri: string }[];
    filter_facets?: { id: string; values: { value: string; count: number }[] }[];
}

interface DiscogsVersion {
    id: number;
    title: string;
    format: string; // On garde le format détaillé pour plus tard
    label: string;
    country: string;
    released: string; // L'année de sortie
    major_formats: string[]; // Le format principal (ex: "Vinyl")
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
            res.status(400).json({ message: "Le paramètre de recherche 'q' est manquant." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Erreur de configuration du serveur." });
            return;
        }

        const discogsApiUrl = `https://api.discogs.com/database/search`;
        const authParams = {
            q: q,
            key: discogsKey,
            secret: discogsSecret
        };
        const headers = { 'User-Agent': 'Musivault/1.0' };

        // 1. Lancer les deux recherches en parallèle
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

        // 2. Créer un Set des master IDs trouvés
        const masterIds = new Set(masters.map(m => m.id));

        // 3. Filtrer les releases orphelines (sans master ou master pas dans nos résultats)
        const orphanReleases = releases.filter(r => !r.master_id || !masterIds.has(r.master_id));

        // 4. Combiner : masters d'abord, puis releases orphelines
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
        console.error("Erreur lors de la recherche d'albums sur Discogs:", error);
        res.status(500).json({ message: "Échec de la recherche." });
    }
}

export async function searchMasters(req: Request, res: Response) {
    try {
        const { q } = req.query; // Le terme de recherche vient des paramètres de la requête

        if (!q) {
            res.status(400).json({ message: "Le paramètre de recherche 'q' est manquant." });
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

        // On nettoie les résultats pour ne renvoyer que l'essentiel
        const cleanedResults = response.data.results.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
        }));
        
        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Erreur lors de la recherche de masters sur Discogs:", error);
        res.status(500).json({ message: "Échec de la recherche." });
    }
}

export async function getMasterVersions(req: Request, res: Response) {
    try {
        const { masterId } = req.params;
        // On récupère la clé et le secret depuis les variables d'environnement
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Erreur de configuration du serveur : clé ou secret Discogs manquant." });
            return;
        }

        const masterDetailsUrl = `https://api.discogs.com/masters/${masterId}`;
        const masterVersionsUrl = `https://api.discogs.com/masters/${masterId}/versions`;
        
        // L'authentification se fait maintenant via les paramètres de la requête
        const authParams = {
            key: discogsKey,
            secret: discogsSecret
        };

        // On lance les deux appels API en parallèle pour gagner du temps
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

        // --- NOUVELLE LOGIQUE DE COMPTAGE MANUEL ---
        // On calcule les comptes nous-mêmes en parcourant la liste des versions.
        const formatCounts: { [key: string]: number } = { CD: 0, Vinyl: 0 };
        versions.forEach(version => {
            if (version.major_formats.includes('Vinyl')) {
                formatCounts.Vinyl++;
            }
            if (version.major_formats.includes('CD')) {
                formatCounts.CD++;
            }
        });

        const finalResponse = {
            masterTitle: detailsResponse.data.title.split(' - ')[0],
            coverImage: detailsResponse.data.images?.[0]?.uri || '', 
            formatCounts: formatCounts,
            versions: versionsResponse.data.versions.map(v => ({
                id: v.id,
                title: v.title,
                format: v.format, // Le format détaillé, pour la modale
                label: v.label,
                country: v.country,
                released: v.released, // L'année de sortie
                majorFormat: v.major_formats?.[0] || 'N/A', // Le format principal
            }))
        };
        
        res.status(200).json(finalResponse);

    } catch (error) {
        console.error(`Erreur lors de la récupération des données pour le master ${req.params.masterId}:`, error);
        res.status(500).json({ message: "Échec de la récupération des données." });
    }
}

export async function searchDiscogs(req: Request, res: Response) {
    try {
        const { q } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!q) {
            res.status(400).json({ message: "Le paramètre de recherche 'q' est manquant." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Erreur de configuration du serveur." });
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

        // On nettoie les résultats et on s'assure d'inclure le type
        const cleanedResults = response.data.results.map(item => ({
            id: item.id,
            title: item.title,
            year: item.year,
            thumb: item.thumb,
            type: item.type, // On passe le type au frontend
        }));
        
        res.status(200).json(cleanedResults);

    } catch (error) {
        console.error("Erreur lors de la recherche sur Discogs:", error);
        res.status(500).json({ message: "Échec de la recherche." });
    }
}

// Recherche d'artistes
export async function searchArtists(req: Request, res: Response) {
    try {
        const { q } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!q) {
            res.status(400).json({ message: "Le paramètre de recherche 'q' est manquant." });
            return;
        }
        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Erreur de configuration du serveur." });
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
        console.error("Erreur lors de la recherche d'artistes sur Discogs:", error);
        res.status(500).json({ message: "Échec de la recherche." });
    }
}

// Récupérer les albums (releases) d'un artiste
export async function getArtistReleases(req: Request, res: Response) {
    try {
        const { artistId } = req.params;
        const { sort = 'year', order = 'desc' } = req.query;
        const discogsKey = process.env.DISCOGS_KEY;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsKey || !discogsSecret) {
            res.status(500).json({ message: "Erreur de configuration du serveur." });
            return;
        }

        // Récupérer les infos de l'artiste
        const artistUrl = `https://api.discogs.com/artists/${artistId}`;
        const releasesUrl = `https://api.discogs.com/artists/${artistId}/releases`;
        
        const authParams = {
            key: discogsKey,
            secret: discogsSecret
        };
        const headers = { 'User-Agent': 'Musivault/1.0' };

        const [artistResponse, releasesResponse] = await Promise.all([
            axios.get<{ name: string; images?: { uri: string }[] }>(artistUrl, { params: authParams, headers }),
            axios.get<{ releases: { id: number; title: string; year: number; thumb: string; type: string; role: string; artist: string; main_release?: number }[] }>(releasesUrl, { 
                params: { ...authParams, per_page: 100, sort: 'year', sort_order: order },
                headers 
            })
        ]);

        // Filtrer pour ne garder que les albums (type master ou release avec role "Main")
        const releases = releasesResponse.data.releases || [];
        const albums = releases
            .filter(r => r.role === 'Main' && (r.type === 'master' || r.type === 'release'))
            .map(r => ({
                id: r.type === 'master' ? r.id : (r.main_release || r.id),
                title: r.title,
                year: r.year || 0,
                thumb: r.thumb,
                type: r.type as 'master' | 'release'
            }));

        // Dédoublonner par titre (garder le premier, généralement le master)
        const seen = new Set<string>();
        const uniqueAlbums = albums.filter(album => {
            const key = album.title.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Trier selon les paramètres
        const sortedAlbums = [...uniqueAlbums].sort((a, b) => {
            if (sort === 'title') {
                const comparison = a.title.localeCompare(b.title);
                return order === 'asc' ? comparison : -comparison;
            } else {
                // Par année
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
        console.error(`Erreur lors de la récupération des albums de l'artiste ${req.params.artistId}:`, error);
        res.status(500).json({ message: "Échec de la récupération des albums." });
    }
}

export async function getReleaseDetails(req: Request, res: Response) {
    try {
        const { releaseId } = req.params;
        const discogsSecret = process.env.DISCOGS_SECRET;

        if (!discogsSecret) {
            console.error("DISCOGS_SECRET n'est pas défini dans les variables d'environnement.");
            res.status(500).json({ message: "Erreur de configuration du serveur." });
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
            artist: data.artists?.map(a => a.name).join(', ') || 'Artiste inconnu',
            year: data.year,
            cover_image: data.images?.find(img => img.type === 'primary')?.uri || data.images?.[0]?.uri || '',
            availableFormats: data.formats?.map(f => ({
                name: f.name,
                descriptions: f.descriptions || [],
                text: f.text || ''
            })) || [] 
        };
        res.status(200).json(cleanedData);

    } catch (error) {
        console.error("Erreur lors de la récupération des détails de la publication sur Discogs:", error);
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            res.status(404).json({ message: "Publication non trouvée sur Discogs." });
            return;
        }
        res.status(500).json({ message: "Échec de la récupération des détails de la publication." });
    }
}
