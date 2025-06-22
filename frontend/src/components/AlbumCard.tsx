import React from 'react';
import type { DiscogsResult } from '../types';


interface AlbumCardProps {
  result: DiscogsResult;
  //onAddToCollection: (album: DiscogsResult) => void;
}


const parseTitle = (fullTitle: string): { artist: string; album: string } => {
    const parts = fullTitle.split(' - ');
    if (parts.length > 1) {
        const album = parts.pop()?.trim() || fullTitle;
        const artist = parts.join(' - ').trim();
        return { artist, album };
    }
    return { artist: "Unknown Artist", album: fullTitle };
};

const AlbumCard: React.FC<AlbumCardProps> = ({ result }) => {
  const { artist, album } = parseTitle(result.title);

  return (
    <div className="flex items-center p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
      <img 
        src={result.thumb} 
        alt={`${artist} - ${album}`}
        className="w-24 h-24 object-cover mr-4 rounded flex-shrink-0" 
      />
      <div className="flex-grow min-w-0">
        <h3 className="text-lg font-bold text-gray-800 truncate" title={album}>
            {album}
        </h3>
        <p className="text-md font-semibold text-gray-700 truncate" title={artist}>
            {artist}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          <strong>Year:</strong> {result.year || 'N/A'}
        </p>
        <div className="mt-3">
          <button
            onClick={() => null}
            className="px-3 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-150 ease-in-out"
          >
            Add to Collection
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbumCard;
