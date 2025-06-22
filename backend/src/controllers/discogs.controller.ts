import { Request, Response } from 'express';
import axios from 'axios';

interface DiscogsResult {
  id: number;
  thumb: string;
  cover_image: string;
  title: string;
  year: number;
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
