import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { searchAll, searchByBarcode, lookup, getRelease } from '../../api/discogs';
import { addToCollection } from '../../api/collection';
import { isApiError, isCanceledError, isRateLimitError } from '../../api/errors';
import { useTranslation } from 'react-i18next';
import { toastService } from "../../utils/toast";
import { stripArtistSuffix } from '../../utils/formatters';
import SearchResultCard from './SearchResultCard';
import BarcodeScannerModal from '../Modal/BarcodeScannerModal';
import SelectReleaseModal from '../Modal/SelectReleaseModal';
import ManualAlbumForm from './ManualAlbumForm';
import type { DiscogsResult, ArtistResult } from '../../types/discogs.types';
import { useDebounce } from '../../hooks/useDebounce';
import { Camera, X, Search } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';


type SearchMode = 'albumArtist' | 'idLookup' | 'manual';

type SearchResults = { albums: DiscogsResult[]; artists: ArtistResult[] };

/** Matches the `lg:` breakpoint used to switch between tabs and the dropdown. */
const MOBILE_QUERY = '(max-width: 1023px)';

/** Below this, typing is treated as still in progress and no request is sent. */
const MIN_QUERY_LENGTH = 3;

const SearchBar: React.FC = () => {
    const { t } = useTranslation();

    // Search mode toggle
    const [searchMode, setSearchMode] = useState<SearchMode>('albumArtist');

    // Album/Artist search state — the query is mirrored into ?q= so going back
    // from a release page restores the search instead of clearing it.
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');
    const syncedQueryRef = useRef<string>(searchParams.get('q') || '');
    const [albumResults, setAlbumResults] = useState<DiscogsResult[]>([]);
    const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    /**
     * Every query costs four Discogs calls (masters + releases, albums + artists),
     * so repeated and back-navigated searches are served from memory instead.
     * Lives for the component's lifetime, which is the length of a search session.
     */
    const resultsCache = useRef<Map<string, SearchResults>>(new Map());

    // Incremental expansion: number of visible items
    const [visibleArtistCount, setVisibleArtistCount] = useState(3);
    const [visibleAlbumCount, setVisibleAlbumCount] = useState(5);

    // ID Lookup state
    const [lookupQuery, setLookupQuery] = useState<string>('');
    const [lookupResults, setLookupResults] = useState<DiscogsResult[]>([]);
    const [isLookupLoading, setIsLookupLoading] = useState<boolean>(false);
    const [lookupSearched, setLookupSearched] = useState<boolean>(false);
    const [lookupType, setLookupType] = useState<'discogsId' | 'catno'>('discogsId');

    // Mobile detection: drives the shorter placeholders, and suppresses autofocus
    // so landing on the home page doesn't pop the keyboard over the content.
    const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

    const navigate = useNavigate();

    // Barcode scanner state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [barcodeResults, setBarcodeResults] = useState<DiscogsResult[]>([]);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [isAddingFromBarcode, setIsAddingFromBarcode] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // Fires only when crossing the breakpoint, unlike a resize listener
    useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_QUERY);
        const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Keep ?q= in sync so the search survives navigating to a release and back.
    // replace: true keeps typing out of the history stack, and the ref guard
    // skips the redundant navigation setSearchParams' changing identity causes.
    useEffect(() => {
        if (syncedQueryRef.current === debouncedSearchQuery) return;
        syncedQueryRef.current = debouncedSearchQuery;

        setSearchParams(
            prev => {
                const next = new URLSearchParams(prev);
                if (debouncedSearchQuery) {
                    next.set('q', debouncedSearchQuery);
                } else {
                    next.delete('q');
                }
                return next;
            },
            { replace: true }
        );
    }, [debouncedSearchQuery, setSearchParams]);

    useEffect(() => {
        const query = debouncedSearchQuery.trim();

        if (query.length < MIN_QUERY_LENGTH) {
            setAlbumResults([]);
            setArtistResults([]);
            setSearchError(null);
            setHasSearched(false);
            return;
        }

        // Reset to initial counts on new search
        setVisibleArtistCount(3);
        setVisibleAlbumCount(5);
        setSearchError(null);

        const cached = resultsCache.current.get(query);
        if (cached) {
            setAlbumResults(cached.albums);
            setArtistResults(cached.artists);
            setHasSearched(true);
            setIsLoading(false);
            return;
        }

        // Aborting on cleanup stops a slow earlier request from overwriting the
        // results of a newer one when responses come back out of order.
        const controller = new AbortController();
        setIsLoading(true);

        const search = async () => {
            try {
                // Execute both searches in parallel
                const { albums, artists } = await searchAll(query, controller.signal);
                resultsCache.current.set(query, { albums, artists });
                setAlbumResults(albums);
                setArtistResults(artists);
                setHasSearched(true);
            } catch (err) {
                if (isCanceledError(err)) return;

                console.error('Search failed:', err);
                setAlbumResults([]);
                setArtistResults([]);
                setHasSearched(true);

                if (isRateLimitError(err)) {
                    setSearchError(t('search.tooManyRequests'));
                    toastService.error(t('search.tooManyRequests'));
                } else if (isApiError(err) && err.isNetworkError) {
                    setSearchError(t('search.networkError'));
                } else {
                    setSearchError(t('search.searchFailed'));
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };
        search();

        return () => controller.abort();
    }, [debouncedSearchQuery, t]);

    const handleSelectAlbum = (result: DiscogsResult) => {
        if (result.type === 'master') {
            navigate(`/app/master/${result.id}`);
        } else {
            navigate(`/app/release/${result.id}`);
        }
    };

    const handleSelectArtist = (artist: ArtistResult) => {
        navigate(`/app/artist/${artist.id}`);
    };

    // Barcode scanning handlers
    const handleScanSuccess = async (barcode: string) => {
        setIsScannerOpen(false);
        setIsAddingFromBarcode(true);
        toastService.info(t('search.searchingBarcode', { barcode }));

        try {
            const results = await searchByBarcode(barcode);

            if (results.length === 0) {
                toastService.error(t('search.noBarcodeResults'));
            } else if (results.length === 1) {
                // Auto-add the single result
                await addReleaseToCollection(results[0].id);
            } else {
                // Multiple results - show selection modal
                setBarcodeResults(results);
                setIsSelectModalOpen(true);
            }
        } catch (err) {
            console.error('Barcode search error:', err);
            if (isRateLimitError(err)) {
                toastService.error(t('search.tooManyRequests'));
            } else if (isApiError(err) && err.serverMessage) {
                toastService.error(err.serverMessage);
            } else {
                toastService.error(t('search.failedSearch'));
            }
        } finally {
            setIsAddingFromBarcode(false);
        }
    };

    const addReleaseToCollection = async (releaseId: number) => {
        setIsAddingFromBarcode(true);
        try {
            // Fetch release details first
            const releaseDetails = await getRelease(releaseId);

            // Use the first available format, or create a default
            const format = releaseDetails.availableFormats?.[0] || {
                name: 'Unknown',
                descriptions: [],
                text: ''
            };

            // Add to collection
            await addToCollection({ ...releaseDetails, format });

            toastService.success(t('search.addedToCollection', { title: releaseDetails.title }));
        } catch (err: unknown) {
            console.error('Error adding to collection:', err);
            if (isApiError(err) && err.serverMessage) {
                toastService.error(err.serverMessage);
            } else {
                toastService.error(t('search.failedAddToCollection'));
            }
        } finally {
            setIsAddingFromBarcode(false);
            setIsSelectModalOpen(false);
        }
    };

    const handleSelectFromBarcode = (release: DiscogsResult) => {
        addReleaseToCollection(release.id);
    };

    // Reset search handler
    const handleResetSearch = () => {
        setSearchQuery('');
        setAlbumResults([]);
        setArtistResults([]);
        setSearchError(null);
        setHasSearched(false);
        setVisibleArtistCount(3);
        setVisibleAlbumCount(5);
    };

    // Reset lookup handler
    const handleResetLookup = () => {
        setLookupQuery('');
        setLookupResults([]);
        setLookupSearched(false);
    };

    // ID Lookup handler
    const handleLookup = async () => {
        if (!lookupQuery.trim()) return;

        setIsLookupLoading(true);
        setLookupSearched(true);

        try {
            const results = await lookup(lookupQuery.trim(), lookupType);
            setLookupResults(Array.isArray(results) ? results : []);
        } catch (err) {
            console.error('Lookup failed:', err);
            if (isRateLimitError(err)) {
                toastService.error(t('search.tooManyRequests'));
            }
            setLookupResults([]);
        } finally {
            setIsLookupLoading(false);
        }
    };

    // Rendering Helpers
    const visibleArtists = artistResults.slice(0, visibleArtistCount);
    const visibleAlbums = albumResults.slice(0, visibleAlbumCount);
    const hasResults = artistResults.length > 0 || albumResults.length > 0;
    const hasLookupResults = lookupResults.length > 0;

    return (
        <div className="w-full max-w-6xl mx-auto">
            {/* Search Mode - Dropdown on Mobile, Tabs on Desktop */}
            <div className="flex justify-center mb-6">
                {/* Mobile: Dropdown */}
                <select
                    className="select w-full max-w-xs lg:hidden"
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                >
                    <option value="albumArtist">{t('search.modeAlbumArtist')}</option>
                    <option value="idLookup">{t('search.modeIdLookup')}</option>
                    <option value="manual">{t('search.modeManual')}</option>
                </select>

                {/* Desktop: Tabs */}
                <div className="tabs tabs-box hidden lg:flex">
                    <button
                        className={`tab ${searchMode === 'albumArtist' ? 'tab-active' : ''}`}
                        onClick={() => setSearchMode('albumArtist')}
                    >
                        {t('search.modeAlbumArtist')}
                    </button>
                    <button
                        className={`tab ${searchMode === 'idLookup' ? 'tab-active' : ''}`}
                        onClick={() => setSearchMode('idLookup')}
                    >
                        {t('search.modeIdLookup')}
                    </button>
                    <button
                        className={`tab ${searchMode === 'manual' ? 'tab-active' : ''}`}
                        onClick={() => setSearchMode('manual')}
                    >
                        {t('search.modeManual')}
                    </button>
                </div>
            </div>

            {/* Album & Artist Search Mode */}
            {searchMode === 'albumArtist' && (
                <>
                    {/* Search bar with barcode scanner and reset buttons */}
                    <div className="relative flex gap-2 mb-6">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={isMobile ? t('search.placeholderShort') : t('search.placeholder')}
                                className="input w-full pr-10"
                                aria-label={t('search.placeholder')}
                                autoFocus={!isMobile}
                            />
                            {isLoading && (
                                <span className="loading loading-spinner loading-sm absolute top-1/2 right-3 -translate-y-1/2"></span>
                            )}
                        </div>
                        {/* Reset button - only show when there are results or a query */}
                        {(searchQuery || hasResults) && (
                            <button
                                className="btn btn-ghost btn-square"
                                onClick={handleResetSearch}
                                title={t('search.resetSearch')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            className="btn btn-primary btn-square"
                            onClick={() => setIsScannerOpen(true)}
                            title={t('search.scanBarcode')}
                            disabled={isAddingFromBarcode}
                        >
                            {isAddingFromBarcode ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                <Camera className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {/* Feedback: hint, error, or no results — one at a time */}
                    {searchError ? (
                        <div role="alert" className="alert alert-error mb-6">
                            <span>{searchError}</span>
                        </div>
                    ) : searchQuery.trim().length > 0 &&
                      searchQuery.trim().length < MIN_QUERY_LENGTH ? (
                        <p className="text-center py-6 text-base-content/60">
                            {t('search.minChars', { min: MIN_QUERY_LENGTH })}
                        </p>
                    ) : hasSearched && !isLoading && !hasResults ? (
                        <div className="text-center py-10 text-base-content/60">
                            <p className="text-lg">
                                {t('search.noResults', { query: debouncedSearchQuery.trim() })}
                            </p>
                            <p className="text-sm mt-1">{t('search.noResultsHint')}</p>
                        </div>
                    ) : null}

                    {/* Screen readers get told when results land */}
                    <p className="sr-only" aria-live="polite">
                        {isLoading
                            ? t('search.searching')
                            : hasResults
                                ? t('search.resultsCount', {
                                      albums: albumResults.length,
                                      artists: artistResults.length
                                  })
                                : ''}
                    </p>

                    {/* Side-by-side layout: Artists left, Albums right */}
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* ARTISTS SECTION - Left side */}
                        {artistResults.length > 0 && (
                            <div className="md:w-1/3">
                                <h3 className="text-xl font-bold mb-4">{t('search.artists')}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                                    {visibleArtists.map((artist) => (
                                        <div
                                            key={artist.id}
                                            role="button"
                                            tabIndex={0}
                                            className="card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                                            onClick={() => handleSelectArtist(artist)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    handleSelectArtist(artist);
                                                }
                                            }}
                                        >
                                            <figure className="px-4 pt-4">
                                                <img
                                                    src={getImageUrl(artist.thumb || '/placeholder-artist.png')}
                                                    alt={stripArtistSuffix(artist.name)}
                                                    className="rounded-full w-20 h-20 object-cover mx-auto"
                                                />
                                            </figure>
                                            <div className="card-body items-center text-center p-3">
                                                <h3 className="card-title text-sm">{stripArtistSuffix(artist.name)}</h3>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {visibleArtistCount < artistResults.length && (
                                    <button
                                        className="btn btn-ghost btn-sm mt-2 w-full"
                                        onClick={() => setVisibleArtistCount(prev => prev + 3)}
                                    >
                                        {t('search.showMore', { count: 3, remaining: artistResults.length - visibleArtistCount })}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ALBUMS SECTION - Right side */}
                        {albumResults.length > 0 && (
                            <div className="md:w-2/3">
                                <h3 className="text-xl font-bold mb-4">{t('common.albums')}</h3>
                                <div className="space-y-4">
                                    {visibleAlbums.map((result) => (
                                        <SearchResultCard
                                            key={result.id}
                                            result={result}
                                            onShowDetails={() => handleSelectAlbum(result)}
                                            isLoadingDetails={false}
                                        />
                                    ))}
                                </div>
                                {visibleAlbumCount < albumResults.length && (
                                    <button
                                        className="btn btn-ghost btn-sm mt-2 w-full"
                                        onClick={() => setVisibleAlbumCount(prev => prev + 5)}
                                    >
                                        {t('search.showMore', { count: 5, remaining: albumResults.length - visibleAlbumCount })}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ID Lookup Mode */}
            {searchMode === 'idLookup' && (
                <>
                    {/* Lookup Type Radio Buttons - Centered */}
                    <div className="flex justify-center gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="lookupType"
                                className="radio radio-primary radio-sm"
                                checked={lookupType === 'discogsId'}
                                onChange={() => setLookupType('discogsId')}
                            />
                            <span>{t('search.lookupTypeDiscogsId')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="lookupType"
                                className="radio radio-primary radio-sm"
                                checked={lookupType === 'catno'}
                                onChange={() => setLookupType('catno')}
                            />
                            <span>{t('search.lookupTypeCatno')}</span>
                        </label>
                    </div>

                    <div className="relative flex gap-2 mb-6">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={lookupQuery}
                                onChange={(e) => setLookupQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                                placeholder={lookupType === 'discogsId'
                                    ? (isMobile ? t('search.placeholderDiscogsIdShort') : t('search.placeholderDiscogsId'))
                                    : (isMobile ? t('search.placeholderCatnoShort') : t('search.placeholderCatno'))}
                                className="input w-full"
                                autoFocus={!isMobile}
                            />
                        </div>
                        {(lookupQuery || hasLookupResults) && (
                            <button
                                className="btn btn-ghost btn-square"
                                onClick={handleResetLookup}
                                title={t('search.resetSearch')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={handleLookup}
                            disabled={isLookupLoading || !lookupQuery.trim()}
                        >
                            {isLookupLoading ? (
                                <span className="loading loading-spinner loading-sm"></span>
                            ) : (
                                <>
                                    <Search className="w-4 h-4" />
                                    {t('search.find')}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Lookup Results */}
                    {hasLookupResults && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold">{t('search.results')}</h3>
                            {lookupResults.map((result) => (
                                <SearchResultCard
                                    key={result.id}
                                    result={result}
                                    onShowDetails={() => handleSelectAlbum(result)}
                                    isLoadingDetails={false}
                                />
                            ))}
                        </div>
                    )}

                    {/* No results message */}
                    {lookupSearched && !isLookupLoading && !hasLookupResults && (
                        <div className="text-center py-8 text-base-content/60">
                            <p>{t('search.noLookupResult')}</p>
                        </div>
                    )}
                </>
            )}

            {/* Manual Entry Mode */}
            {searchMode === 'manual' && (
                <ManualAlbumForm />
            )}

            {/* Barcode Scanner Modal */}
            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />

            {/* Select Release Modal (for multiple barcode matches) */}
            <SelectReleaseModal
                isOpen={isSelectModalOpen}
                results={barcodeResults}
                onClose={() => setIsSelectModalOpen(false)}
                onSelect={handleSelectFromBarcode}
                isLoading={isAddingFromBarcode}
            />
        </div>
    );
};

export default SearchBar;

