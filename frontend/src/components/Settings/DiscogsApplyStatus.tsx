import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DiscogsApply } from '../../types/discogsAccount.types';

interface Props {
    apply: DiscogsApply;
    /** Ask the job to stop. Without it there is no Stop button. */
    onStop?: () => void;
}

/** Progress of the running apply, or what the last one did. */
const DiscogsApplyStatus: React.FC<Props> = ({ apply, onStop }) => {
    const { t } = useTranslation();

    // Running states get an info box with a spinner, so it is clear something is happening on the server.
    if (apply.status === 'queued' || apply.status === 'running') {
        const records = apply.status === 'running' && apply.phase === 'records';
        return (
            <div role="status" className="alert alert-info items-start text-sm" data-testid="apply-running">
                <span className="loading loading-spinner loading-sm mt-0.5"></span>
                <div className="flex flex-col gap-1 w-full">
                    <p className="font-medium">
                        {apply.status === 'queued' && t('discogsApply.queued')}
                        {apply.status === 'running' && apply.phase === 'collection' && t('discogsApply.reading')}
                        {apply.status === 'running' && apply.phase === 'dates' && t('discogsApply.updatingDates')}
                        {records && t('discogsApply.progress', { done: apply.done, total: apply.total })}
                    </p>
                    {records && (
                        <progress className="progress w-full max-w-xs" value={apply.done} max={Math.max(apply.total, 1)}></progress>
                    )}
                    {apply.status === 'running' && <p className="text-xs opacity-80">{t('discogsApply.canLeave')}</p>}
                    {apply.stopRequested && <p className="text-xs font-medium">{t('discogsApply.stopping')}</p>}
                </div>
                {onStop && (
                    <button className="btn btn-sm btn-outline shrink-0" disabled={apply.stopRequested} onClick={onStop}>
                        {t('discogsApply.stop')}
                    </button>
                )}
            </div>
        );
    }

    if (apply.status === 'error') {
        return (
            <div role="alert" className="alert alert-warning text-sm">
                <span>{t(apply.errorCode === 'needsReconnect' ? 'discogsAccount.needsReconnect' : 'discogsApply.failed')}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 text-sm" data-testid="apply-result">
            {apply.stopped ? (
                <p className="text-warning">
                    {t('discogsApply.stoppedDone', { done: apply.done, total: apply.total, added: apply.added, relinked: apply.relinked })}
                </p>
            ) : (
                <p className="text-success">
                    {t('discogsApply.done', { added: apply.added, relinked: apply.relinked })}
                </p>
            )}
            {apply.datesUpdated > 0 && <p>{t('discogsApply.datesDone', { count: apply.datesUpdated })}</p>}
            {apply.instanceIdsStored > 0 && (
                <p className="text-base-content/70">{t('discogsApply.linked', { count: apply.instanceIdsStored })}</p>
            )}
            {apply.skipped > 0 && <p className="text-base-content/70">{t('discogsApply.skipped', { count: apply.skipped })}</p>}
            {apply.failed > 0 && <p className="text-warning">{t('discogsApply.failedCount', { count: apply.failed })}</p>}
            {apply.failures.length > 0 && (
                <details>
                    <summary className="cursor-pointer text-base-content/70">{t('discogsApply.details')}</summary>
                    <ul className="divide-y divide-base-300 max-h-60 overflow-y-auto mt-1">
                        {apply.failures.map(f => (
                            <li key={`${f.kind}-${f.releaseId}`} className="py-1">
                                <span className="font-medium">{f.artist}</span> — {f.title}
                                <span className="text-base-content/50"> · {f.reason}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
};

export default DiscogsApplyStatus;
