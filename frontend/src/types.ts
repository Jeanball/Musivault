export interface DiscogsResult {
  id: number;
  thumb: string;
  title: string;
  year: string;
  type: 'master' | 'release' | 'artist' | 'label';
  master_id: number | null;
}

export interface ArtistAlbum {
  id: number;
  title: string;
  year: string;
  thumb: string;
  type: 'master' | 'release';
  format: string;
  label: string;
  role: string;
  master_id: number | null;
}

export interface ArtistReleasesData {
  artistName: string;
  artistImage: string;
  releases: ArtistAlbum[];
}
