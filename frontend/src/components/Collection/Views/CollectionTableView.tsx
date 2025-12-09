import React from 'react';
import type { CollectionItem, SortColumn } from '../../../types/collection';

interface CollectionTableViewProps {
    items: CollectionItem[];
    onItemClick: (item: CollectionItem) => void;
    onSort: (column: SortColumn) => void;
    getSortIcon: (column: SortColumn) => string;
}

const CollectionTableView: React.FC<CollectionTableViewProps> = ({
    items,
    onItemClick,
    onSort,
    getSortIcon
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="table w-full">
                <thead>
                    <tr>
                        <th>Cover</th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('artist')}
                        >
                            Artist {getSortIcon('artist')}
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('album')}
                        >
                            Album {getSortIcon('album')}
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('format')}
                        >
                            Format {getSortIcon('format')}
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('year')}
                        >
                            Year {getSortIcon('year')}
                        </th>
                        <th
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => onSort('addedAt')}
                        >
                            Added {getSortIcon('addedAt')}
                        </th>
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
                                <div className="font-bold">{item.album.artist}</div>
                            </td>
                            <td>
                                <div className="font-semibold">{item.album.title}</div>
                            </td>
                            <td>
                                <div className="badge badge-secondary">{item.format.name}</div>
                                {item.format.text && item.format.text !== item.format.name && (
                                    <div className="text-xs opacity-70 mt-1">{item.format.text}</div>
                                )}
                            </td>
                            <td>{item.album.year || 'N/A'}</td>
                            <td>{new Date(item.addedAt).toLocaleDateString('en-US')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default CollectionTableView;
