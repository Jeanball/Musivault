import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDiscogsReport, startDiscogsCheck } from '../../api/discogsSync';
import { toastService } from '../../utils/toast';
import type { DiscogsSyncReport } from '../../types/discogsAccount.types';

const POLL_MS = 2000;
/** Rows rendered per section; the counts above always show the full numbers. */
const MAX_ROWS = 100;

interface RowProps {
    artist: string;
    title: string;
    detail?: string;
    /** Discogs release to open, when the row has one. */
    discogsId?: number;
}

const Row: React.FC<RowProps> = ({ artist, title, detail, discogsId }) => {
    const { t } = useTranslation();
    return (
        <li className="py-1 text-sm flex items-center gap-1">
            <span className="min-w-0">
                <span className="font-medium">{artist}</span> — {title}
                {detail && <span className="text-base-content/50"> · {detail}</span>}
            </span>
            {discogsId && (
                <a
                    href={`https://www.discogs.com/release/${discogsId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-hover shrink-0 text-base-content/60"
                    aria-label={t('discogsCheck.openOnDiscogs')}
                    title={t('discogsCheck.openOnDiscogs')}
                >
                    <ExternalLink size={13} />
                </a>
            )}
        </li>
    );
};

interface SectionProps {
    title: string;
    hint: string;
    count: number;
    children: React.ReactNode[];
}

const Section: React.FC<SectionProps> = ({ title, hint, count, children }) => {
    const { t } = useTranslation();
    if (count === 0) return null;
    return (
        <details className="collapse collapse-arrow bg-base-100">
            <summary className="collapse-title font-medium">
                {title} <span className="badge badge-ghost ml-2">{count}</span>
            </summary>
            <div className="collapse-content">
                <p className="text-xs text-base-content/60 mb-2">{hint}</p>
                <ul className="divide-y divide-base-300 max-h-80 overflow-y-auto">
                    {children.slice(0, MAX_ROWS)}
                </ul>
                {count > MAX_ROWS && (
                    <p className="text-xs text-base-content/50 mt-2">
                        {t('discogsCheck.moreRows', { count: count - MAX_ROWS })}
                    </p>
                )}
            </div>
        </details>
    );
};

/** Read-only check of the Discogs collection against Musivault: a button, progress, and the last report. */
const DiscogsCheckReport: React.FC = () => {
    const { t } = useTranslation();
    const [report, setReport] = useState<DiscogsSyncReport | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const inProgress = report?.status === 'queued' || report?.status === 'running';

    const load = useCallback(async () => {
        try {
            setReport(await getDiscogsReport());
        } catch (error) {
            console.error('Failed to fetch the Discogs report:', error);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Poll while a check runs; it keeps going on the server if the user leaves Settings.
    useEffect(() => {
        if (!inProgress) return;
        timerRef.current = setTimeout(() => void load(), POLL_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [inProgress, report, load]);

    const start = async () => {
        setIsStarting(true);
        try {
            await startDiscogsCheck();
            await load();
        } catch {
            toastService.error(t('discogsCheck.startFailed'));
        } finally {
            setIsStarting(false);
        }
    };

    const completed = report?.status === 'completed' ? report : null;

    return (
        <div className="mt-4 pt-4 border-t border-base-300 flex flex-col gap-3">
            <div>
                <h3 className="font-semibold">{t('discogsCheck.title')}</h3>
                <p className="text-sm text-base-content/70">{t('discogsCheck.description')}</p>
            </div>

            <button className="btn btn-primary btn-sm self-start" disabled={isStarting || inProgress} onClick={start}>
                {(isStarting || inProgress) && <span className="loading loading-spinner loading-xs"></span>}
                {t('discogsCheck.checkNow')}
            </button>

            {report?.status === 'queued' && (
                <p className="text-sm text-base-content/70">{t('discogsCheck.queued')}</p>
            )}
            {report?.status === 'running' && (
                <p className="text-sm text-base-content/70">
                    {report.progress.pages > 0
                        ? t('discogsCheck.progress', { page: report.progress.page, pages: report.progress.pages })
                        : t('discogsCheck.starting')}
                </p>
            )}
            {report?.status === 'error' && (
                <div role="alert" className="alert alert-warning text-sm">
                    <span>{t(report.errorCode === 'needsReconnect' ? 'discogsAccount.needsReconnect' : 'discogsCheck.failed')}</span>
                </div>
            )}

            {completed && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-base-content/50">
                        {t('discogsCheck.lastChecked', { date: new Date(completed.finishedAt ?? completed.startedAt).toLocaleString() })}
                    </p>
                    <p className="text-sm">
                        {t('discogsCheck.summary', { discogs: completed.counts.discogs, matched: completed.counts.matched })}
                    </p>
                    {completed.counts.dateDiffers > 0 && (
                        <p className="text-sm text-base-content/70">
                            {t('discogsCheck.dateDiffers', { count: completed.counts.dateDiffers })}
                        </p>
                    )}
                    {completed.counts.newOnDiscogs + completed.counts.merged + completed.counts.onlyInMusivault === 0 && (
                        <p className="text-sm text-success">{t('discogsCheck.inSync')}</p>
                    )}

                    <Section
                        title={t('discogsCheck.newTitle')}
                        hint={t('discogsCheck.newHint')}
                        count={completed.counts.newOnDiscogs}
                    >
                        {completed.newOnDiscogs.map(r => (
                            <Row key={r.releaseId} artist={r.artist} title={r.title} detail={[r.year, r.format].filter(Boolean).join(' · ')} discogsId={r.releaseId} />
                        ))}
                    </Section>
                    <Section
                        title={t('discogsCheck.mergedTitle')}
                        hint={t('discogsCheck.mergedHint')}
                        count={completed.counts.merged}
                    >
                        {completed.merged.map(m => (
                            <Row
                                key={m.item.itemId}
                                artist={m.item.artist}
                                title={m.item.title}
                                detail={t('discogsCheck.mergedDetail', { id: m.release.releaseId })}
                                discogsId={m.release.releaseId}
                            />
                        ))}
                    </Section>
                    <Section
                        title={t('discogsCheck.onlyTitle')}
                        hint={t('discogsCheck.onlyHint')}
                        count={completed.counts.onlyInMusivault}
                    >
                        {completed.onlyInMusivault.map(i => (
                            <Row key={i.itemId} artist={i.artist} title={i.title} detail={i.format} discogsId={i.discogsId} />
                        ))}
                    </Section>
                </div>
            )}
        </div>
    );
};

export default DiscogsCheckReport;
