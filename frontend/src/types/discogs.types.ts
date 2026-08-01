export interface DiscogsResult {
  id: number;
  thumb: string;
  title: string;
  year: string;
  type: 'master' | 'release';
}

export interface ArtistResult {
  id: number;
  name: string;
  thumb: string;
}

export interface ArtistAlbum {
  id: number;
  title: string;
  year: number;
  thumb: string;
  type: 'master' | 'release';
}

export interface ArtistPageData {
  artist: {
    id: string;
    name: string;
    image: string;
  };
  albums: ArtistAlbum[];
}
