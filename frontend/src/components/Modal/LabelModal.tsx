import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLabelInfo } from '../../api/discogs';
import { getImageUrl } from '../../utils/imageUrl';
import { DISCOGS_BUTTON_STYLE } from '../../utils/brandColors';
import type { Label } from '../../types/collection.types';
import type { LabelInfo } from '../../types/discogs.types';

interface LabelModalProps {
    label: Label | null;
    onClose: () => void;
}

/** Strips the http(s):// and trailing slash so links read like a brand, not a URL. */
const prettyUrl = (url: string): string =>
    url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/**
 * Discogs profiles are written in BBCode: `[a=Carl Craig]` references keep their
 * name, everything else ([b], [url=...], ...) is dropped.
 */
const stripBBCode = (profile: string): string =>
    profile
        .replace(/\[(?:a|l|m|r)=([^\]]+)\]/gi, '$1')
        .replace(/\[[^\]]*\]/g, '')
        .trim();

const LabelModal: React.FC<LabelModalProps> = ({ label, onClose }) => {
    const { t } = useTranslation();
    const [info, setInfo] = useState<LabelInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!label) return;

        let cancelled = false;
        setInfo(null);
        setNotFound(false);
        setIsLoading(true);

        getLabelInfo(label.discogsId ? { id: label.discogsId } : { name: label.name })
            .then((data) => {
                if (!cancelled) setInfo(data);
            })
            .catch(() => {
                // A label Discogs doesn't know and a failed request lead to the same
                // dead end for the user, so both show the "no info" message.
                if (!cancelled) setNotFound(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [label]);

    if (!label) return null;

    const otherUrls = (info?.urls || []).filter((url) => url !== info?.officialUrl);

    return (
        <dialog className="modal modal-middle px-2 sm:px-4" open>
            <div className="modal-box max-w-md w-full">
                <div className="flex items-start gap-4">
                    {info?.image && (
                        <img
                            src={getImageUrl(info.image)}
                            alt={info.name}
                            className="w-16 h-16 rounded-lg object-contain bg-base-200 shrink-0"
                        />
                    )}
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg leading-tight break-words">
                            {info?.name || label.name}
                        </h3>
                        {label.catno && label.catno !== 'none' && (
                            <p className="text-sm text-base-content/60 mt-0.5">
                                {t('album.catalogNumber')} · {label.catno}
                            </p>
                        )}
                    </div>
                </div>

                {isLoading && (
                    <div className="flex justify-center py-8">
                        <span className="loading loading-spinner loading-md" />
                    </div>
                )}

                {!isLoading && notFound && (
                    <p className="py-6 text-sm text-base-content/60">{t('label.notFound')}</p>
                )}

                {!isLoading && info && (
                    <>
                        {info.profile && (
                            <p className="mt-4 text-sm text-base-content/70 whitespace-pre-line line-clamp-6">
                                {stripBBCode(info.profile)}
                            </p>
                        )}

                        <div className="mt-5 flex flex-col gap-2">
                            {info.officialUrl ? (
                                <a
                                    href={info.officialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary btn-sm w-full"
                                >
                                    {t('label.visitOfficialSite')}
                                    <span className="opacity-70 truncate">
                                        {prettyUrl(info.officialUrl)}
                                    </span>
                                </a>
                            ) : (
                                <p className="text-xs text-base-content/50">{t('label.noOfficialSite')}</p>
                            )}

                            <a
                                href={info.discogsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm w-full border-none"
                                style={DISCOGS_BUTTON_STYLE}
                            >
                                {t('label.viewOnDiscogs')}
                            </a>
                        </div>

                        {otherUrls.length > 0 && (
                            <div className="mt-4">
                                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/50 mb-1.5">
                                    {t('label.otherLinks')}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {otherUrls.slice(0, 6).map((url) => (
                                        <a
                                            key={url}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="badge badge-outline badge-sm hover:badge-primary max-w-full truncate"
                                        >
                                            {prettyUrl(url)}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="modal-action">
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>
                        {t('common.close')}
                    </button>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={onClose}>close</button>
            </form>
        </dialog>
    );
};

export default LabelModal;
