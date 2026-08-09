export interface DiscogsResult {
  id: number;
  thumb: string;
  title: string;
  year: string;
  type: 'master' | 'release';
  /** Pressing details from the search hit, shown so a result can be judged in the list */
  format?: string[];
  label?: string;
  country?: string;
  catno?: string;
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

export interface LabelInfo {
  discogsId: number;
  name: string;
  profile: string;
  /** The label's own website, empty when Discogs doesn't know one */
  officialUrl: string;
  /** Every external link Discogs lists (socials, Bandcamp, ...) */
  urls: string[];
  discogsUrl: string;
  image: string;
}

export interface ArtistPageData {
  artist: {
    id: string;
    name: string;
    image: string;
  };
  albums: ArtistAlbum[];
}
