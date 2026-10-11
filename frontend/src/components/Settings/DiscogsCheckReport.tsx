import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { applyDiscogsSelection, getDiscogsReport, startDiscogsCheck, stopDiscogsApply } from '../../api/discogsSync';
import { useCollectionData } from '../../hooks/collection/useCollectionData';
import { toastService } from '../../utils/toast';
import type { DiscogsApplySelection, DiscogsSyncReport } from '../../types/discogsAccount.types';
import DiscogsApplyStatus from './DiscogsApplyStatus';
import { useDiscogsPending } from '../../context/DiscogsPendingContext';

const POLL_MS = 2000;
/** Rows rendered per section; the counts above always show the full numbers. */
const MAX_ROWS = 100;

interface RowProps {
    artist: string;
    title: string;
    detail?: string;
    /** Discogs release to open, when the row has one. */
    discogsId?: number;
    /** Rows that can be applied have a checkbox; the others are for information. */
    checked?: boolean;
    onToggle?: () => void;
}

const Row: React.FC<RowProps> = ({ artist, title, detail, discogsId, checked, onToggle }) => {
    const { t } = useTranslation();
    return (
        <li className="py-1 text-sm flex items-center gap-2">
            {onToggle && (
                <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={!!checked}
                    onChange={onToggle}
                    aria-label={`${artist} — ${title}`}
                />
            )}
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
    /** Set for sections whose rows can be ticked: how many are, and the buttons to tick or untick them all. */
    selected?: number;
    onSelectAll?: () => void;
    onSelectNone?: () => void;
}

const Section: React.FC<SectionProps> = ({ title, hint, count, children, selected, onSelectAll, onSelectNone }) => {
    const { t } = useTranslation();
    const [showAll, setShowAll] = useState(false);
    if (count === 0) return null;
    // Rows that can be ticked are all ticked to start with, so the ones past the cap can be revealed to untick them.
    const tickable = !!onSelectAll;
    return (
        <details className="collapse collapse-arrow bg-base-100">
            <summary className="collapse-title font-medium">
                {title} <span className="badge badge-ghost ml-2">{count}</span>
            </summary>
            <div className="collapse-content">
                <p className="text-xs text-base-content/60 mb-2">{hint}</p>
                {onSelectAll && onSelectNone && (
                    <div className="flex items-center gap-2 mb-2 text-xs">
                        <span>{t('discogsApply.selected', { selected, count })}</span>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={onSelectAll}>{t('discogsApply.selectAll')}</button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={onSelectNone}>{t('discogsApply.selectNone')}</button>
                    </div>
                )}
                <ul className="divide-y divide-base-300 max-h-80 overflow-y-auto">
                    {showAll ? children : children.slice(0, MAX_ROWS)}
                </ul>
                {count > MAX_ROWS && !showAll && (
                    <p className="text-xs text-base-content/50 mt-2">
                        {t(tickable ? 'discogsApply.moreHidden' : 'discogsCheck.moreRows', { count: count - MAX_ROWS })}
                        {tickable && (
                            <button type="button" className="btn btn-ghost btn-xs ml-1" onClick={() => setShowAll(true)}>
                                {t('discogsApply.showAll')}
                            </button>
                        )}
                    </p>
                )}
            </div>
        </details>
    );
};

type Confirm = 'all' | 'selected' | 'dates' | null;

/** About how long Discogs' rate limit makes one added record take (two calls, a bit over a second apart each). */
const SECONDS_PER_RECORD = 5;
/** From this many records to add, the user is told it will take a while before it starts. */
const LARGE_APPLY = 100;

/** The rows the user unticked in the result identified by `result` (its finish time). */
interface Unticked {
    result: string | null;
    new: Set<number>;
    merged: Set<string>;
}

/**
 * Check the Discogs collection against Musivault and apply what the user ticks: a button, progress,
 * the last report with tickable rows, and the apply buttons. Nothing changes until the user applies.
 */
const DiscogsCheckReport: React.FC = () => {
    const { t } = useTranslation();
    const { refreshCollection } = useCollectionData();
    const { refresh: refreshPending } = useDiscogsPending();
    const [report, setReport] = useState<DiscogsSyncReport | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    // Every row of a result starts ticked, so what is kept is the rows the user unticked, for that result.
    const [unticked, setUntickedState] = useState<Unticked>({ result: null, new: new Set(), merged: new Set() });
    const [confirm, setConfirm] = useState<Confirm>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasApplying = useRef(false);
    const wasChecking = useRef(false);

    const checking = report?.status === 'queued' || report?.status === 'running';
    const applying = report?.apply?.status === 'queued' || report?.apply?.status === 'running';
    const busy = isStarting || checking || applying;

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

    // Poll while a check or an apply runs; both keep going on the server if the user leaves Settings.
    useEffect(() => {
        if (!checking && !applying) return;
        timerRef.current = setTimeout(() => void load(), POLL_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [checking, applying, report, load]);

    // When a check or an apply finishes: an apply changed the collection under the list, and both change
    // what the navbar badge counts (what the last check left to do).
    useEffect(() => {
        const applyDone = wasApplying.current && !applying;
        const checkDone = wasChecking.current && !checking;
        if (applyDone) void refreshCollection({ silent: true });
        if (applyDone || checkDone) void refreshPending();
        wasApplying.current = applying;
        wasChecking.current = checking;
    }, [applying, checking, refreshCollection, refreshPending]);

    const resultKey = report?.status === 'completed' ? report.finishedAt ?? report.startedAt : null;
    const current = unticked.result === resultKey ? unticked : { result: resultKey, new: new Set<number>(), merged: new Set<string>() };
    const selectedNew = new Set((report?.newOnDiscogs ?? []).map(r => r.releaseId).filter(id => !current.new.has(id)));
    const selectedMerged = new Set((report?.merged ?? []).map(m => m.item.itemId).filter(id => !current.merged.has(id)));
    const setUnticked = (change: Partial<Pick<Unticked, 'new' | 'merged'>>) =>
        setUntickedState({ ...current, ...change });

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

    const apply = async (selection: DiscogsApplySelection) => {
        setConfirm(null);
        setIsStarting(true);
        try {
            await applyDiscogsSelection(selection);
            await load();
        } catch (error) {
            const busyElsewhere = axios.isAxiosError(error) && error.response?.status === 409;
            toastService.error(t(busyElsewhere ? 'discogsApply.busy' : 'discogsApply.startFailed'));
        } finally {
            setIsStarting(false);
        }
    };

    const stop = async () => {
        try {
            await stopDiscogsApply();
            await load();
        } catch {
            toastService.error(t('discogsApply.stopFailed'));
        }
    };

    const completed = report?.status === 'completed' ? report : null;

    const selectionOf = (all: boolean): DiscogsApplySelection => ({
        add: completed ? completed.newOnDiscogs.filter(r => all || selectedNew.has(r.releaseId)).map(r => r.releaseId) : [],
        relink: completed
            ? completed.merged
                .filter(m => all || selectedMerged.has(m.item.itemId))
                .map(m => ({ itemId: m.item.itemId, releaseId: m.release.releaseId }))
            : [],
        useDiscogsDates: false
    });
    const estimate = (records: number): string => {
        const totalMinutes = Math.max(1, Math.round((records * SECONDS_PER_RECORD) / 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours === 0) return t('discogsApply.durationMinutes', { minutes });
        return minutes === 0
            ? t('discogsApply.durationHours', { hours })
            : t('discogsApply.durationHoursMinutes', { hours, minutes });
    };
    const tickedCount = selectedNew.size + selectedMerged.size;
    const allCount = completed ? completed.counts.newOnDiscogs + completed.counts.merged : 0;

    const toggle = <K extends number | string>(unticks: Set<K>, key: K): Set<K> => {
        const next = new Set(unticks);
        if (!next.delete(key)) next.add(key);
        return next;
    };

    return (
        <div className="mt-4 pt-4 border-t border-base-300 flex flex-col gap-3">
            <div>
                <h3 className="font-semibold">{t('discogsCheck.title')}</h3>
                <p className="text-sm text-base-content/70">{t('discogsCheck.description')}</p>
            </div>

            <button className="btn btn-primary btn-sm self-start" disabled={busy} onClick={start}>
                {(isStarting || checking) && <span className="loading loading-spinner loading-xs"></span>}
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

            {report?.apply && <DiscogsApplyStatus apply={report.apply} onStop={() => void stop()} />}

            {completed && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs text-base-content/50">
                        {t('discogsCheck.lastChecked', { date: new Date(completed.finishedAt ?? completed.startedAt).toLocaleString() })}
                    </p>
                    <p className="text-sm">
                        {t('discogsCheck.summary', { discogs: completed.counts.discogs, matched: completed.counts.matched })}
                    </p>
                    {completed.counts.dateDiffers > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-base-content/70">
                                {t('discogsCheck.dateDiffers', { count: completed.counts.dateDiffers })}
                            </p>
                            <button className="btn btn-outline btn-xs" disabled={busy} onClick={() => setConfirm('dates')}>
                                {t('discogsApply.useDates')}
                            </button>
                        </div>
                    )}
                    {completed.counts.newOnDiscogs + completed.counts.merged + completed.counts.onlyInMusivault === 0 && (
                        <p className="text-sm text-success">{t('discogsCheck.inSync')}</p>
                    )}

                    {allCount > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={busy || tickedCount === 0}
                                onClick={() => selectedNew.size > LARGE_APPLY ? setConfirm('selected') : void apply(selectionOf(false))}
                            >
                                {t('discogsApply.applySelected', { count: tickedCount })}
                            </button>
                            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setConfirm('all')}>
                                {t('discogsApply.applyAll', { count: allCount })}
                            </button>
                        </div>
                    )}

                    <Section
                        title={t('discogsCheck.newTitle')}
                        hint={t('discogsCheck.newHint')}
                        count={completed.counts.newOnDiscogs}
                        selected={selectedNew.size}
                        onSelectAll={() => setUnticked({ new: new Set() })}
                        onSelectNone={() => setUnticked({ new: new Set(completed.newOnDiscogs.map(r => r.releaseId)) })}
                    >
                        {completed.newOnDiscogs.map(r => (
                            <Row
                                key={r.releaseId}
                                artist={r.artist}
                                title={r.title}
                                detail={[r.year, r.format].filter(Boolean).join(' · ')}
                                discogsId={r.releaseId}
                                checked={selectedNew.has(r.releaseId)}
                                onToggle={() => setUnticked({ new: toggle(current.new, r.releaseId) })}
                            />
                        ))}
                    </Section>
                    <Section
                        title={t('discogsCheck.mergedTitle')}
                        hint={t('discogsCheck.mergedHint')}
                        count={completed.counts.merged}
                        selected={selectedMerged.size}
                        onSelectAll={() => setUnticked({ merged: new Set() })}
                        onSelectNone={() => setUnticked({ merged: new Set(completed.merged.map(m => m.item.itemId)) })}
                    >
                        {completed.merged.map(m => (
                            <Row
                                key={m.item.itemId}
                                artist={m.item.artist}
                                title={m.item.title}
                                detail={[
                                    t('discogsCheck.mergedDetail', { id: m.release.releaseId }),
                                    t(m.match === 'instance' ? 'discogsCheck.mergedExact' : 'discogsCheck.mergedLikely')
                                ].join(' · ')}
                                discogsId={m.release.releaseId}
                                checked={selectedMerged.has(m.item.itemId)}
                                onToggle={() => setUnticked({ merged: toggle(current.merged, m.item.itemId) })}
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

            {confirm && completed && (
                <dialog className="modal modal-middle px-2 sm:px-4" open onCancel={() => setConfirm(null)}>
                    <div className="modal-box">
                        <h3 className="font-bold text-lg">
                            {t(
                                confirm === 'all' ? 'discogsApply.confirmAllTitle'
                                    : confirm === 'selected' ? 'discogsApply.confirmLargeTitle'
                                        : 'discogsApply.confirmDatesTitle'
                            )}
                        </h3>
                        <p className="py-3 text-sm">
                            {confirm === 'dates'
                                ? t('discogsApply.confirmDatesBody', { count: completed.counts.dateDiffers })
                                : confirm === 'all'
                                    ? t('discogsApply.confirmAllBody', {
                                        added: completed.counts.newOnDiscogs,
                                        relinked: completed.counts.merged
                                    })
                                    : t('discogsApply.confirmLargeBody', { count: selectedNew.size })}
                        </p>
                        {confirm !== 'dates' && (confirm === 'selected' || completed.counts.newOnDiscogs > LARGE_APPLY) && (
                            <p className="text-sm text-warning">
                                {t('discogsApply.longWarning', {
                                    count: confirm === 'selected' ? selectedNew.size : completed.counts.newOnDiscogs,
                                    duration: estimate(confirm === 'selected' ? selectedNew.size : completed.counts.newOnDiscogs)
                                })}
                            </p>
                        )}
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>{t('discogsApply.cancel')}</button>
                            <button
                                className="btn btn-primary"
                                onClick={() => void apply(confirm === 'dates' ? { add: [], relink: [], useDiscogsDates: true } : selectionOf(confirm === 'all'))}
                            >
                                {t('discogsApply.confirm')}
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button type="button" onClick={() => setConfirm(null)}>{t('discogsApply.cancel')}</button>
                    </form>
                </dialog>
            )}
        </div>
    );
};

export default DiscogsCheckReport;
