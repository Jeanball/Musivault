import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { searchAll, searchByBarcode, lookup, getRelease } from '../../api/discogs';
import { addToCollection } from '../../api/collection';
import { isApiError, isCanceledError, isRateLimitError } from '../../api/errors';
import { useTranslation } from 'react-i18next';
import { toastService } from "../../utils/toast";
import { stripDiscogsSuffix } from '../../utils/formatters';
import SearchResultCard from './SearchResultCard';
import SearchResultSkeleton from './SearchResultSkeleton';
import BarcodeScannerModal from '../Modal/BarcodeScannerModal';
import SelectReleaseModal from '../Modal/SelectReleaseModal';
import ManualAlbumForm from './ManualAlbumForm';
import type { DiscogsResult, ArtistResult } from '../../types/discogs.types';
import { useDebounce } from '../../hooks/useDebounce';
import { useRecentSearches } from '../../hooks/useRecentSearches';
import { detectIntent } from '../../utils/searchIntent';
import SearchField from './SearchField';
import { ScanFrameIcon } from './SearchIcons';
import { PenLine, ArrowLeft } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';


type SearchResults = { albums: DiscogsResult[]; artists: ArtistResult[] };

/** Matches the `lg:` breakpoint used for the longer placeholder. */
const MOBILE_QUERY = '(max-width: 1023px)';

/** Below this, typing is treated as still in progress and no request is sent. */
const MIN_QUERY_LENGTH = 3;

/** Enough rows to fill the fold, so one click covers most searches. */
const ALBUM_PAGE_SIZE = 20;

/** The rail scrolls, so a fixed slice is enough. */
const MAX_ARTISTS = 8;

const SearchBar: React.FC = () => {
    const { t } = useTranslation();

    // The query is mirrored into ?q= so going back from a release page restores
    // the search instead of clearing it.
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');
    const syncedQueryRef = useRef<string>(searchParams.get('q') || '');
    const [albumResults, setAlbumResults] = useState<DiscogsResult[]>([]);
    const [artistResults, setArtistResults] = useState<ArtistResult[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    /** Set when the list holds an exact reference match rather than a text search */
    const [matchedReference, setMatchedReference] = useState<string | null>(null);
    const [showManualForm, setShowManualForm] = useState(false);

    /**
     * Every query costs four Discogs calls (masters + releases, albums + artists),
     * so repeated and back-navigated searches are served from memory instead.
     * Lives for the component's lifetime, which is the length of a search session.
     */
    const resultsCache = useRef<Map<string, SearchResults>>(new Map());

    const [visibleAlbumCount, setVisibleAlbumCount] = useState(ALBUM_PAGE_SIZE);

    /** Row the arrow keys point at; -1 while focus is still in the field */
    const [activeIndex, setActiveIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const { recents, remember, clear: clearRecents } = useRecentSearches();

    // Mobile detection: drives the shorter placeholder, and suppresses autofocus
    // so landing on the home page doesn't pop the keyboard over the content.
    const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

    const navigate = useNavigate();

    // Barcode scanner state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [barcodeResults, setBarcodeResults] = useState<DiscogsResult[]>([]);
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [isAddingFromBarcode, setIsAddingFromBarcode] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 400);
    const intent = detectIntent(searchQuery);

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
            setMatchedReference(null);
            return;
        }

        setVisibleAlbumCount(ALBUM_PAGE_SIZE);
        setActiveIndex(-1);
        setSearchError(null);
        setMatchedReference(null);

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
                if (albums.length > 0 || artists.length > 0) remember(query);
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
    }, [debouncedSearchQuery, t, remember]);

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

    /**
     * The query itself says whether it is a reference: acting on it is offered,
     * never imposed, so a text search that happens to look like a catalog number
     * still returns its normal results.
     */
    const handleReferenceLookup = async () => {
        if (intent.kind === 'text') return;

        setIsLoading(true);
        setSearchError(null);
        setActiveIndex(-1);
        try {
            const results = intent.kind === 'barcode'
                ? await searchByBarcode(intent.value)
                : await lookup(intent.value, intent.kind === 'catno' ? 'catno' : 'discogsId');

            if (intent.kind === 'discogsId' && results.length === 1) {
                handleSelectAlbum(results[0]);
                return;
            }

            setAlbumResults(results);
            setArtistResults([]);
            setHasSearched(true);
            setVisibleAlbumCount(ALBUM_PAGE_SIZE);
            setMatchedReference(results.length > 0 ? intent.value : null);
            if (results.length === 0) setSearchError(t('search.noLookupResult'));
            else remember(intent.value);
        } catch (err) {
            console.error('Reference lookup failed:', err);
            setSearchError(isRateLimitError(err) ? t('search.tooManyRequests') : t('search.searchFailed'));
        } finally {
            setIsLoading(false);
        }
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

    const handleResetSearch = () => {
        setSearchQuery('');
        setAlbumResults([]);
        setArtistResults([]);
        setSearchError(null);
        setHasSearched(false);
        setMatchedReference(null);
        setVisibleAlbumCount(ALBUM_PAGE_SIZE);
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const visibleArtists = artistResults.slice(0, MAX_ARTISTS);
    const visibleAlbums = albumResults.slice(0, visibleAlbumCount);
    const hasResults = artistResults.length > 0 || albumResults.length > 0;
    const isTooShort = searchQuery.trim().length > 0 && searchQuery.trim().length < MIN_QUERY_LENGTH;

    /** Arrow keys run the list from inside the field, so typing never stops. */
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (visibleAlbums.length === 0) return;
            e.preventDefault();
            setActiveIndex(prev => {
                const next = e.key === 'ArrowDown' ? prev + 1 : prev - 1;
                return Math.max(0, Math.min(visibleAlbums.length - 1, next));
            });
        } else if (e.key === 'Enter' && activeIndex > -1 && visibleAlbums[activeIndex]) {
            e.preventDefault();
            handleSelectAlbum(visibleAlbums[activeIndex]);
        } else if (e.key === 'Escape' && searchQuery) {
            e.preventDefault();
            handleResetSearch();
        }
    };

    // Keeps the highlighted row in view when the arrows walk past the fold.
    // Keyed on the row id, so an unrelated re-render doesn't yank the scroll.
    const activeResultId = activeIndex > -1 ? visibleAlbums[activeIndex]?.id : undefined;
    useEffect(() => {
        if (!activeResultId) return;
        document.getElementById(`search-result-${activeResultId}`)?.scrollIntoView({ block: 'nearest' });
    }, [activeResultId]);

    // The dock's Search item asks for the cursor. The flag is consumed right away
    // so coming back to the home screen later doesn't pop the keyboard on its own.
    const location = useLocation();
    useEffect(() => {
        if (!(location.state as { focusSearch?: boolean } | null)?.focusSearch) return;
        inputRef.current?.focus();
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }, [location, navigate]);

    // A single shortcut to get back to the field from anywhere on the page
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    if (showManualForm) {
        return (
            <div className="w-full max-w-6xl mx-auto">
                <button
                    className="btn btn-ghost btn-sm mb-4 gap-2 h-11 min-h-11 sm:h-8 sm:min-h-8"
                    onClick={() => setShowManualForm(false)}
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('search.backToSearch')}
                </button>
                <ManualAlbumForm />
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto">
            {/* Search field, the only entry point: references and barcodes are
                recognised from what is typed instead of asking for a mode first.
                It sticks to the top on mobile so a typo can be fixed without
                scrolling the results back up. */}
            {/* The negative margin matches the p-6 of the card this sits in, so the
                sticky band spans its full width instead of leaving a gap for content
                to scroll through. */}
            <div className="sticky top-0 z-20 -mx-6 px-6 pt-1 pb-2 sm:py-3 bg-base-200 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <SearchField
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onReset={handleResetSearch}
                        resetLabel={t('search.resetSearch')}
                        placeholder={isMobile ? t('search.placeholderShort') : t('search.placeholder')}
                        isLoading={isLoading}
                        inputRef={inputRef}
                        inputProps={{
                            onKeyDown: handleInputKeyDown,
                            role: 'combobox',
                            'aria-expanded': visibleAlbums.length > 0,
                            'aria-controls': 'search-results-list',
                            'aria-activedescendant': activeResultId ? `search-result-${activeResultId}` : undefined,
                            autoFocus: !isMobile
                        }}
                        trailing={
                            <>
                                <kbd className="kbd kbd-sm hidden lg:inline-flex shrink-0">⌘K</kbd>
                                <button
                                    className="btn btn-ghost btn-square h-10 w-10 min-h-10 shrink-0 text-base-content/70 hover:text-base-content"
                                    onClick={() => setIsScannerOpen(true)}
                                    title={t('search.scanBarcode')}
                                    aria-label={t('search.scanBarcode')}
                                    disabled={isAddingFromBarcode}
                                >
                                    {isAddingFromBarcode ? (
                                        <span className="loading loading-spinner loading-sm"></span>
                                    ) : (
                                        <ScanFrameIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </>
                        }
                    />
                </div>
                {/* Adding by hand is a peer of searching, so it sits beside the field
                    from sm: up. On mobile it would eat the sticky band, so it is
                    rendered under the field instead (below), where it scrolls away. */}
                <button
                    className="btn btn-outline gap-2 shrink-0 hidden sm:inline-flex h-14 min-h-14"
                    onClick={() => setShowManualForm(true)}
                >
                    <PenLine className="w-4 h-4" />
                    {t('search.modeManual')}
                </button>
            </div>

            <button
                className="btn btn-outline btn-sm gap-2 w-full h-11 min-h-11 mt-2 sm:hidden"
                onClick={() => setShowManualForm(true)}
            >
                <PenLine className="w-4 h-4" />
                {t('search.modeManual')}
            </button>

            {/* Reference detected in the query: offered, never imposed */}
            {intent.kind !== 'text' && (
                <div className="flex flex-wrap items-center gap-3 mt-3 py-2.5 px-3 bg-primary/10 border-l-4 border-primary">
                    <span className="text-sm">
                        {t(
                            intent.kind === 'discogsId' ? 'search.intentDiscogsId'
                                : intent.kind === 'barcode' ? 'search.intentBarcode'
                                    : 'search.intentCatno'
                        )}
                        {': '}
                        <span className="font-mono font-semibold">{intent.value}</span>
                    </span>
                    <button
                        className="btn btn-primary btn-sm ml-auto h-11 min-h-11 sm:h-8 sm:min-h-8"
                        onClick={handleReferenceLookup}
                        disabled={isLoading}
                    >
                        {t(
                            intent.kind === 'discogsId' ? 'search.intentOpenRelease'
                                : intent.kind === 'barcode' ? 'search.intentFindPressing'
                                    : 'search.intentSearchCatalog'
                        )}
                    </button>
                </div>
            )}

            {/* Feedback: error or hint, one at a time. It only takes room when it
                has something to say, so the results stay tight under the field. */}
            {(searchError || isTooShort) && (
                <div className="mt-2">
                    {searchError ? (
                        <div role="alert" className="alert alert-error py-2">
                            <span>{searchError}</span>
                        </div>
                    ) : (
                        <p className="text-sm text-base-content/60">
                            {t('search.minChars', { min: MIN_QUERY_LENGTH })}
                        </p>
                    )}
                </div>
            )}

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

            {/* Empty screen: recent searches, and a way in that isn't the field */}
            {!searchQuery.trim() && !isLoading && (
                <div className="py-2">
                    {recents.length > 0 && (
                        <>
                            <div className="flex items-baseline justify-between mb-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                    {t('search.recentSearches')}
                                </h3>
                                <button className="btn btn-ghost btn-xs h-9 min-h-9 sm:h-6 sm:min-h-6" onClick={clearRecents}>
                                    {t('search.clearRecents')}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-6">
                                {recents.map(query => (
                                    <button
                                        key={query}
                                        className="btn btn-sm btn-outline font-normal h-11 min-h-11 sm:h-8 sm:min-h-8"
                                        onClick={() => {
                                            setSearchQuery(query);
                                            inputRef.current?.focus();
                                        }}
                                    >
                                        {query}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                </div>
            )}

            {/* Loading: rows in place of the stale ones, so nothing outdated stays clickable */}
            {isLoading && !hasResults && (
                <div className="mt-2 border-t border-base-300 sm:border-0 sm:space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <SearchResultSkeleton key={i} />)}
                </div>
            )}

            {/* Nothing found */}
            {hasSearched && !isLoading && !hasResults && !searchError && (
                <div className="py-8 text-center">
                    <p className="text-lg">{t('search.noResults', { query: debouncedSearchQuery.trim() })}</p>
                    <p className="text-sm text-base-content/60 mt-1">{t('search.noResultsHint')}</p>
                    <button
                        className="btn btn-outline btn-sm mt-4 gap-2 h-11 min-h-11 sm:h-8 sm:min-h-8"
                        onClick={() => setShowManualForm(true)}
                    >
                        <PenLine className="w-4 h-4" />
                        {t('search.modeManual')}
                    </button>
                </div>
            )}

            {/* Artists ride above the albums as a rail: the layout no longer
                reflows between one and two columns depending on what came back. */}
            {artistResults.length > 0 && (
                <div className="mt-2 sm:mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-2">
                        {t('search.artists')}
                    </h3>
                    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
                        {visibleArtists.map((artist) => (
                            <button
                                key={artist.id}
                                /* cursor-pointer is explicit: Tailwind 4's reset gives
                                   bare buttons `cursor: default`, unlike a `btn`. The
                                   lift and the press-in say "this is a control", the
                                   motion-safe guard keeps it still for anyone who asked
                                   the system for less movement. */
                                className="group shrink-0 w-16 sm:w-24 flex flex-col items-center gap-1.5 sm:gap-2 p-1 sm:p-2 rounded-field cursor-pointer transition-all duration-200 hover:bg-base-200 motion-safe:active:scale-95 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                                onClick={() => handleSelectArtist(artist)}
                            >
                                <img
                                    src={getImageUrl(artist.thumb || '/placeholder-artist.png')}
                                    alt={stripDiscogsSuffix(artist.name)}
                                    className="rounded-full w-11 h-11 sm:w-14 sm:h-14 object-cover ring-2 ring-base-300 transition-all duration-200 group-hover:ring-primary motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-105"
                                    loading="lazy"
                                />
                                <span className="text-[11px] sm:text-xs text-center leading-tight line-clamp-2 transition-colors duration-200 group-hover:text-primary">
                                    {stripDiscogsSuffix(artist.name)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Albums */}
            {albumResults.length > 0 && (
                <div className="mt-2 sm:mt-4">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                            {matchedReference
                                ? t('search.exactMatch', { reference: matchedReference })
                                : t('common.albums')}
                            <span className="ml-2 tabular-nums font-normal normal-case">
                                ({albumResults.length})
                            </span>
                        </h3>
                        <span className="hidden lg:inline text-xs text-base-content/50">
                            {t('search.keyboardHint')}
                        </span>
                    </div>
                    <div id="search-results-list" role="listbox" aria-label={t('common.albums')} className="border-t border-base-300 sm:border-0 sm:space-y-3">
                        {visibleAlbums.map((result, index) => (
                            <SearchResultCard
                                key={`${result.type}-${result.id}`}
                                result={result}
                                optionId={`search-result-${result.id}`}
                                isActive={index === activeIndex}
                                onShowDetails={() => handleSelectAlbum(result)}
                            />
                        ))}
                    </div>
                    {visibleAlbumCount < albumResults.length && (
                        <button
                            className="btn btn-ghost btn-sm mt-3 w-full h-11 min-h-11 sm:h-8 sm:min-h-8"
                            onClick={() => setVisibleAlbumCount(prev => prev + ALBUM_PAGE_SIZE)}
                        >
                            {t('search.showMore', {
                                count: Math.min(ALBUM_PAGE_SIZE, albumResults.length - visibleAlbumCount),
                                remaining: albumResults.length - visibleAlbumCount
                            })}
                        </button>
                    )}
                </div>
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
