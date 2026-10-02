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
    availableFormats?: FormatDetails[];
}
