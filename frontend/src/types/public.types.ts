import type { CollectionItem } from './collection.types';

export interface PublicUser {
    username: string;
    publicShareId: string;
    albumCount: number;
    createdAt: string;
    latestAlbums?: CollectionItem[];
}

export interface PublicCollection {
    username: string;
    collection: CollectionItem[];
    total: number;
}
