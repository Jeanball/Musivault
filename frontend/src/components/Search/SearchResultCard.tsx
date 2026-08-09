import React from 'react';
import { useTranslation } from 'react-i18next';
import { parseTitle } from '../../utils/formatters';
import { getImageUrl } from '../../utils/imageUrl';
import type { DiscogsResult } from '../../types/discogs.types';

interface SearchResultCardProps {
  result: DiscogsResult;
  onShowDetails: (releaseId: number) => void;
  /**
   * `option` only inside a listbox the arrow keys drive; a plain list of rows
   * uses the default and stays a button.
   */
  role?: 'option' | 'button';
  /**
   * Left out, the artist is read from the "Artist - Album" title. Pass null on a
   * screen that already names the artist, so it isn't repeated on every row.
   */
  artistName?: string | null;
  /** Highlighted by the arrow keys: the row Enter would open */
  isActive?: boolean;
  /** Set when the card sits in a listbox, so the active row can be announced */
  optionId?: string;
}

/** Beyond three, the descriptors stop helping and start wrapping. */
const MAX_FORMAT_PARTS = 3;

const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  onShowDetails,
  role = 'button',
  artistName,
  isActive = false,
  optionId
}) => {
  const { t } = useTranslation();
  const parsed = parseTitle(result.title);
  const album = artistName === undefined ? parsed.album : result.title;
  const artist = artistName === undefined ? parsed.artist || t('common.unknownArtist') : artistName;

  const formatParts = (result.format || []).slice(0, MAX_FORMAT_PARTS).join(', ');
  const reference = [result.label, result.catno].filter(Boolean).join(' · ');

  return (
    <div
      id={optionId}
      role={role}
      aria-selected={role === 'option' ? isActive : undefined}
      tabIndex={0}
      onClick={() => onShowDetails(result.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onShowDetails(result.id);
        }
      }}
      /* Mobile keeps a divided list: no card padding or fill, so more of the
         result fits above the keyboard. The card look returns from sm: up. */
      className={`flex items-center gap-3 py-2 border-b border-base-300 cursor-pointer transition-colors hover:bg-base-300 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary sm:p-3 sm:border-0 sm:rounded-lg sm:bg-base-200 ${
        isActive ? 'bg-base-300 ring-2 ring-primary' : ''
      }`}
    >
      <img
        src={getImageUrl(result.thumb)}
        alt={artist ? `${artist} - ${album}` : album}
        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-sm shrink-0"
        loading="lazy"
      />

      <div className="grow min-w-0">
        <h3 className="font-bold text-sm sm:text-base leading-tight truncate" title={album}>{album}</h3>
        {artist && (
          <p className="text-xs sm:text-sm text-base-content/70 truncate" title={artist}>{artist}</p>
        )}
        {/* Master vs release stays implicit: a specific pressing is the one carrying
            a format, a label and a catalog number. The words themselves mean nothing
            to most people. */}
        <div className="flex flex-wrap items-center gap-1 mt-1 sm:mt-1.5">
          {result.year && (
            <span className="badge badge-xs sm:badge-sm badge-ghost tabular-nums">{result.year}</span>
          )}
          {formatParts && (
            <span className="badge badge-xs sm:badge-sm badge-ghost max-w-48 truncate" title={formatParts}>
              {formatParts}
            </span>
          )}
          {reference && (
            <span className="badge badge-xs sm:badge-sm badge-ghost max-w-56 truncate hidden sm:inline-flex" title={reference}>
              {reference}
            </span>
          )}
          {result.country && (
            <span className="badge badge-xs sm:badge-sm badge-ghost hidden sm:inline-flex">{result.country}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
