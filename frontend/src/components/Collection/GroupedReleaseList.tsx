import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';
import { revealIfCached } from '../../utils/imageReveal';

/**
 * A record of the collection as a group lists it. Both aggregations already
 * produce this exact shape, which is why they can share a list at all.
 */
export interface GroupedRelease {
    collectionItemId: string;
    title: string;
    artist: string;
    year: string;
    cover_image: string;
    thumb: string;
}

export interface ReleaseGroup {
    id: string;
    releases: GroupedRelease[];
}

interface GroupedReleaseListProps<G extends ReleaseGroup> {
    groups: G[];
    /** The group's own identity: a track's title, a label's name. */
    renderHeader: (group: G) => React.ReactNode;
    onSelect: (collectionItemId: string) => void;
    expandedId: string | null;
    onToggle: (id: string) => void;
}

const ReleaseRow: React.FC<{ release: GroupedRelease; onSelect: () => void; nested?: boolean }> = ({
    release,
    onSelect,
    nested = false,
}) => (
    <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
            }
        }}
        className={`flex items-center gap-3 p-2 rounded-field cursor-pointer transition-colors ${
            nested ? 'bg-base-300 hover:bg-primary/10' : 'hover:bg-base-300'
        }`}
    >
        <div className="w-12 h-12 rounded-field overflow-hidden bg-base-300 shrink-0">
            <img
                ref={revealIfCached}
                src={getImageUrl(release.thumb || release.cover_image || '/placeholder-album.svg')}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/placeholder-album.svg';
                }}
            />
        </div>
        <div className="flex-1 min-w-0">
            <div className="font-medium truncate" title={release.title}>{release.title}</div>
            <div className="text-sm text-base-content/60 truncate">
                {release.artist}{release.year && ` • ${release.year}`}
            </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-base-content/40" />
    </div>
);

/**
 * Groups of records, one open at a time.
 *
 * A group holding a single record does not fold: expanding one only ever
 * revealed that one record, which cost a click to learn what the row could
 * have said outright. Those show their record inline instead.
 *
 * Shared by the tracks and labels views, which are the same thing seen through
 * two lenses: a named group, a count, and the records under it.
 */
function GroupedReleaseList<G extends ReleaseGroup>({
    groups,
    renderHeader,
    onSelect,
    expandedId,
    onToggle,
}: GroupedReleaseListProps<G>) {
    const { t } = useTranslation();

    return (
        <div className="space-y-2">
            {groups.map((group) => {
                const isOpen = expandedId === group.id;

                if (group.releases.length === 1) {
                    return (
                        <div key={group.id} className="bg-base-200 rounded-box p-2">
                            <div className="px-1 pt-1">{renderHeader(group)}</div>
                            <div className="mt-2">
                                <ReleaseRow
                                    release={group.releases[0]}
                                    onSelect={() => onSelect(group.releases[0].collectionItemId)}
                                    nested
                                />
                            </div>
                        </div>
                    );
                }

                return (
                    <div key={group.id} className="bg-base-200 rounded-box">
                        {/* A plain button rather than daisyUI's collapse: its
                            checkbox covers the whole title area, which would bury
                            any link a header wants to carry. */}
                        <button
                            type="button"
                            onClick={() => onToggle(group.id)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center gap-4 p-4 text-left cursor-pointer"
                        >
                            <div className="flex-1 min-w-0">{renderHeader(group)}</div>
                            <ChevronDown
                                size={20}
                                className={`shrink-0 text-base-content/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isOpen && (
                            <div className="px-4 pb-4 space-y-2">
                                <div className="text-sm text-base-content/60">
                                    {t('collection.releasesInGroup', { count: group.releases.length })}
                                </div>
                                {group.releases.map((release) => (
                                    <ReleaseRow
                                        key={release.collectionItemId}
                                        release={release}
                                        onSelect={() => onSelect(release.collectionItemId)}
                                        nested
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default GroupedReleaseList;
