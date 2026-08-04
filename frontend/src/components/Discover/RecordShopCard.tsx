import React from 'react';
import { useTranslation } from 'react-i18next';
import { Store, MapPin, Globe, Phone, Navigation, Clock } from 'lucide-react';
import type { RecordShop } from '../../types/discover.types';
import { formatDistance } from '../../utils/formatters';

interface RecordShopCardProps {
    shop: RecordShop;
}

const RecordShopCard: React.FC<RecordShopCardProps> = ({ shop }) => {
    const { t, i18n } = useTranslation();

    const address = [shop.street, [shop.postcode, shop.city].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');

    // base-200 rather than base-100: the page itself sits on base-100, so a card
    // on that token would have no edge at all against the background.
    return (
        <div className="card bg-base-200 shadow-xs hover:shadow-md transition-shadow duration-300 h-full">
            <div className="card-body p-4 gap-2">
                <div className="flex items-start justify-between gap-2">
                    {/* min-w-0 on both flex levels: without it the name refuses to
                        shrink below its natural width and overflows the card on
                        narrow screens instead of wrapping. */}
                    <h3 className="card-title text-base leading-tight items-start min-w-0 flex-1" title={shop.name}>
                        <Store size={18} className="shrink-0 opacity-70 mt-0.5" />
                        {/* Two lines, then ellipsis — long names stay readable
                            without letting one card tower over its neighbours. */}
                        <span className="min-w-0 line-clamp-2 wrap-break-word">{shop.name}</span>
                    </h3>
                    <span className="badge badge-ghost badge-sm whitespace-nowrap shrink-0">
                        {t('discover.kmAway', { distance: formatDistance(shop.distanceKm, i18n.language) })}
                    </span>
                </div>

                {address && (
                    <p className="text-sm text-base-content/70 flex items-start gap-1.5">
                        <MapPin size={14} className="shrink-0 mt-0.5 opacity-60" />
                        <span className="min-w-0 wrap-break-word">{address}</span>
                    </p>
                )}

                {shop.openingHours && (
                    <p className="text-xs text-base-content/60 flex items-start gap-1.5">
                        <Clock size={14} className="shrink-0 mt-0.5 opacity-60" />
                        <span className="min-w-0 wrap-break-word">{shop.openingHours}</span>
                    </p>
                )}

                <div className="card-actions mt-auto pt-2 flex-nowrap gap-2">
                    <a
                        href={`https://www.openstreetmap.org/directions?to=${shop.lat},${shop.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm gap-1.5"
                    >
                        <Navigation size={14} />
                        {t('discover.directions')}
                    </a>
                    {shop.website && (
                        <a
                            href={shop.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm btn-square"
                            title={t('discover.shopWebsite')}
                            aria-label={t('discover.shopWebsite')}
                        >
                            <Globe size={16} />
                        </a>
                    )}
                    {shop.phone && (
                        <a
                            href={`tel:${shop.phone}`}
                            className="btn btn-ghost btn-sm btn-square"
                            title={shop.phone}
                            aria-label={t('discover.shopPhone')}
                        >
                            <Phone size={16} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecordShopCard;
