import React from 'react';
import type { CollectionItem } from '../../../types/collection';

interface CollectionListViewProps {
    groupedItems: Record<string, CollectionItem[]>;
    onItemClick: (item: CollectionItem) => void;
}

const CollectionListView: React.FC<CollectionListViewProps> = ({
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
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Cover</th>
                                    <th>Album</th>
                                    <th>Format</th>
                                    <th>Released</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr
                                        key={item._id}
                                        onClick={() => onItemClick(item)}
                                        className="hover cursor-pointer"
                                    >
                                        <td>
                                            <div className="avatar">
                                                <div className="w-12 h-12 rounded-lg">
                                                    <img
                                                        src={item.album.thumb || item.album.cover_image}
                                                        alt={item.album.title}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-bold">{item.album.title}</div>
                                        </td>
                                        <td>
                                            <div className="font-semibold">{item.format.name}</div>
                                            {item.format.text && item.format.text !== item.format.name && (
                                                <div className="text-xs opacity-70">{item.format.text}</div>
                                            )}
                                        </td>
                                        <td>{item.album.year}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default CollectionListView;
