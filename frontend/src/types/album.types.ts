export interface FormatDetails {
    name: string;
    descriptions: string[];
    text: string;
}

export interface AlbumDetails {
    discogsId: number;
    master_id?: number;
    title: string;
    artist: string;
    year: string;
    thumb: string;
    cover_image: string;
    /** Broad Discogs genres, kept apart from the styles shown as "Generi". */
    genres?: string[];
    availableFormats?: FormatDetails[];
}
