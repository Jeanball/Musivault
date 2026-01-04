import React from 'react';
import type { CollectionItem } from '../../../types/collection.types';

interface CollectionGridViewProps {
    groupedItems: Record<string, CollectionItem[]>;
    onItemClick: (item: CollectionItem) => void;
}

const CollectionGridView: React.FC<CollectionGridViewProps> = ({
    groupedItems,
    onItemClick
}) => {
    return (
        <div className="space-y-10">
            {Object.entries(groupedItems).map(([artist, items]) => (
                <div key={artist}>
                    <h2 className="text-2xl font-bold mb-4 pb-2 border-b-2 border-primary/50">
                        {artist}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {items.map((item) => (
                            <div
                                key={item._id}
                                onClick={() => onItemClick(item)}
                                className="card bg-base-200 shadow-xl transition-transform hover:scale-105 cursor-pointer"
                            >
                                <figure>
                                    <img
                                        src={item.album.cover_image || item.album.thumb}
                                        alt={item.album.title}
                                        className="aspect-square object-cover"
                                    />
                                </figure>
                                <div className="card-body p-3">
                                    <h2
                                        className="card-title text-sm font-bold leading-tight truncate"
                                        title={item.album.title}
                                    >
                                        {item.album.title}
                                    </h2>
                                    <div className="card-actions justify-start mt-2">
                                        <div className="badge badge-secondary">{item.format.name}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CollectionGridView;
