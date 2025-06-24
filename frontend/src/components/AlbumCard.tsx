import React from 'react';

export interface DiscogsResult {
  id: number;
  thumb: string;
  title: string;
  year: string;
}

interface AlbumCardProps {
  result: DiscogsResult;
  onShowDetails: (releaseId: number) => void;
  isLoadingDetails: boolean;
}

const parseTitle = (fullTitle: string): { artist: string; album: string } => {
    const parts = fullTitle.split(' - ');
    if (parts.length > 1) {
        const album = parts.pop()?.trim() || fullTitle;
        const artist = parts.join(' - ').trim();
        return { artist, album };
    }
    return { artist: "Artiste inconnu", album: fullTitle };
};

const AlbumCard: React.FC<AlbumCardProps> = ({ result, onShowDetails, isLoadingDetails }) => {
  const { artist, album } = parseTitle(result.title);

  return (
    <div
      onClick={() => onShowDetails(result.id)}
      className="relative flex items-center p-4 bg-base-200 rounded-lg shadow-md transition-all duration-200 hover:shadow-xl hover:bg-base-300 cursor-pointer"
    >
      <img 
        src={result.thumb} 
        alt={`${artist} - ${album}`}
        className="w-20 h-20 object-cover mr-4 rounded flex-shrink-0" 
      />
      <div className="flex-grow min-w-0">
        <h3 className="text-lg font-bold text-gray-100 truncate" title={album}>
            {album}
        </h3>
        <p className="text-md text-gray-400 truncate" title={artist}>
            {artist}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Année: {result.year || 'N/A'}
        </p>
      </div>

      {isLoadingDetails && (
        <div className="absolute inset-0 bg-black bg-opacity-60 flex justify-center items-center rounded-lg">
          <span className="loading loading-spinner loading-md text-white"></span>
        </div>
      )}
    </div>
  );
};

export default AlbumCard;