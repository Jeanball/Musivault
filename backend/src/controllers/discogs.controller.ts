import { Request, Response } from 'express';
import axios from 'axios';

interface DiscogsResult {
  id: number;
  thumb: string;
  cover_image: string;
  title: string;
  year: number;
}

interface DiscogsFormat { name: string; }
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


export async function searchDiscogs(req: Request, res: Response) {
  const query = req.query.q;

  if (!query) {
    res.status(400).json({ error: 'Missing search query' });
    return;
  }

  try {
    const response = await axios.get('https://api.discogs.com/database/search', {
      params: {
        q: query,
        type: 'release',
        key: process.env.DISCOGS_KEY,
        secret: process.env.DISCOGS_SECRET,
      },
      headers: {
        'User-Agent': 'Musivault/1.0 +https://yourapp.com'
      }
    });

    const results: DiscogsResult[] = response.data.results.map((item: any) => ({
      id: item.id,
      thumb: item.thumb,
      cover_image: item.cover_image,
      title: item.title,
      year: item.year,
    }));

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching from Discogs:', error);
    res.status(500).json({ error: 'Failed to fetch results from Discogs' });
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
            availableFormats: data.formats?.map(f => f.name) || [] 
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
