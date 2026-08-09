import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getItemValue } from '../../utils/itemValue';
import { getImageUrl } from '../../utils/imageUrl';
import { revealIfCached } from '../../utils/imageReveal';
import { useCurrency } from '../../hooks/useCurrency';
import type { CollectionItem } from '../../types/collection.types';

interface TopValueItemsProps {
    collection: CollectionItem[];
    currency: string;
}

const TOP_COUNT = 5;

/**
 * The most valuable records in the collection.
 *
 * Priced against the grade each copy is actually in, via getItemValue — the same
 * rule the total uses, so this list always adds up to part of the figure above.
 */
const TopValueItems: React.FC<TopValueItemsProps> = ({ collection, currency }) => {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();

    const top = useMemo(() => (
        collection
            .map((item) => ({ item, value: getItemValue(item) }))
            .filter((entry) => entry.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, TOP_COUNT)
    ), [collection]);

    if (top.length === 0) return null;

    return (
        <div className="bg-base-100 rounded-box shadow-lg p-4 md:p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold">{t('stats.mostValuable')}</h2>

            <ol className="flex flex-col gap-2">
                {top.map(({ item, value }, index) => (
                    <li key={item._id} className="flex items-center gap-3">
                        <span className="w-4 shrink-0 text-sm tabular-nums text-base-content/40">
                            {index + 1}
                        </span>
                        <div className="size-11 shrink-0 rounded-md overflow-hidden bg-base-300">
                            <img
                                ref={revealIfCached}
                                src={getImageUrl(item.album?.cover_image || '/placeholder-album.svg')}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="size-full object-cover opacity-0 transition-opacity duration-300"
                                onLoad={(e) => { e.currentTarget.classList.remove('opacity-0'); }}
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/placeholder-album.svg';
                                }}
                            />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" title={item.album?.title}>
                                {item.album?.title}
                            </div>
                            <div className="truncate text-xs text-base-content/60">
                                {item.album?.artist}
                                {item.mediaCondition && ` · ${item.mediaCondition}`}
                            </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatValue(value, currency)}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default TopValueItems;
