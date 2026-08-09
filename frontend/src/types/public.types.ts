import type { CollectionItem } from './collection.types';

export interface PublicUser {
    username: string;
    publicShareId: string;
    albumCount: number;
    createdAt: string;
    latestAlbums?: CollectionItem[];
}

/** A public collection item, carrying the collector it belongs to. */
export interface CommunityAlbum extends CollectionItem {
    user: {
        username: string;
        publicShareId: string;
    };
}

export interface PublicCollection {
    username: string;
    collection: CollectionItem[];
    total: number;
}
