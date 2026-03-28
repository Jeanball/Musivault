import React from 'react';
import type { CollectionItem } from '../../../types/collection.types';
import { getItemValue } from '../../../types/collection.types';
import { getImageUrl } from '../../../utils/imageUrl';

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
                                <figure className="aspect-square w-full bg-base-300 relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-base-content/20">
                                        {/* Simple music icon as a placeholder */}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <img
                                        src={getImageUrl(item.album.cover_image || item.album.thumb)}
                                        alt={item.album.title}
                                        loading="lazy"
                                        className="w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300"
                                        onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                                    />
                                </figure>
                                <div className="card-body p-3">
                                    <h2
                                        className="card-title text-sm font-bold leading-tight truncate"
                                        title={item.album.title}
                                    >
                                        {item.album.title}
                                    </h2>
                                    <div className="card-actions justify-start mt-2 gap-1">
                                        <div className="badge badge-secondary">{item.format.name}</div>
                                        {(() => {
                                            const val = getItemValue(item);
                                            return val > 0 ? (
                                                <div className="badge badge-warning badge-outline font-semibold">
                                                    {new Intl.NumberFormat(undefined, {
                                                        style: 'currency',
                                                        currency: item.priceCache?.currency || 'USD',
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    }).format(val)}
                                                </div>
                                            ) : (
                                                <div className="badge badge-ghost badge-outline text-base-content/50">
                                                    N/A
                                                </div>
                                            );
                                        })()}
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
