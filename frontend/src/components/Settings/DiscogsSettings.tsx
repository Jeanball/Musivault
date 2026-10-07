import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Disc3 } from 'lucide-react';
import { toastService } from '../../utils/toast';
import { isApiError } from '../../api/errors';
import { connectDiscogsAccount, disconnectDiscogsAccount } from '../../api/discogsAccount';
import DiscogsCheckReport from './DiscogsCheckReport';
import type { DiscogsAccountStatus } from '../../types/discogsAccount.types';

interface DiscogsSettingsProps {
    status: Extract<DiscogsAccountStatus, { available: true }>;
    /** Re-fetch the status after the connection changed. */
    onChanged: () => Promise<void>;
}

const DiscogsSettings: React.FC<DiscogsSettingsProps> = ({ status, onChanged }) => {
    const { t } = useTranslation();
    const { connection, canUseServerAccount } = status;
    const [showForm, setShowForm] = useState(false);
    const [token, setToken] = useState('');
    const [isBusy, setIsBusy] = useState(false);

    const connect = async (body: Parameters<typeof connectDiscogsAccount>[0]) => {
        setIsBusy(true);
        try {
            await connectDiscogsAccount(body);
            setToken('');
            setShowForm(false);
            await onChanged();
            toastService.success(t('discogsAccount.connected'));
        } catch (error) {
            const rejected = isApiError(error) && error.status === 400;
            toastService.error(t(rejected ? 'discogsAccount.tokenRejected' : 'discogsAccount.connectFailed'));
        } finally {
            setIsBusy(false);
        }
    };

    const disconnect = async () => {
        setIsBusy(true);
        try {
            await disconnectDiscogsAccount();
            setShowForm(false);
            await onChanged();
            toastService.success(t('discogsAccount.disconnected'));
        } catch {
            toastService.error(t('settings.failedUpdateSetting'));
        } finally {
            setIsBusy(false);
        }
    };

    // A connection with a rejected own token is re-entered here too; a server one just needs Connect again.
    const showTokenForm = connection ? connection.needsReconnect && connection.source === 'own' : showForm;

    const handleToggle = () => {
        if (connection) {
            void disconnect();
        } else {
            setShowForm(!showForm);
        }
    };

    return (
        <div className="card bg-base-200 shadow-card">
            <div className="card-body">
                <h2 className="card-title flex items-center gap-2">
                    <Disc3 size={20} />
                    {t('discogsAccount.title')}
                </h2>

                <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={!!connection || showForm}
                            onChange={handleToggle}
                            disabled={isBusy}
                        />
                        <span className="label-text font-medium">{t('discogsAccount.syncToggle')}</span>
                    </label>
                    <p className="text-sm text-base-content/70">{t('discogsAccount.description')}</p>
                </div>

                {connection && (
                    <div className="mt-2 flex flex-col gap-3">
                        <div>
                            <p className="font-medium">
                                {t('discogsAccount.connectedAs', { username: connection.username })}
                            </p>
                            <p className="text-xs text-base-content/50">
                                {t(connection.source === 'server' ? 'discogsAccount.sourceServer' : 'discogsAccount.sourceOwn')}
                            </p>
                        </div>
                        {connection.needsReconnect && (
                            <div role="alert" className="alert alert-warning text-sm">
                                <AlertTriangle size={18} />
                                <span>{t('discogsAccount.needsReconnect')}</span>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {connection.needsReconnect && connection.source === 'server' && (
                                <button className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => connect({ source: 'server' })}>
                                    {t('discogsAccount.connect')}
                                </button>
                            )}
                            <button className="btn btn-outline btn-sm" disabled={isBusy} onClick={disconnect}>
                                {t('discogsAccount.disconnect')}
                            </button>
                        </div>
                    </div>
                )}

                {connection && !connection.needsReconnect && <DiscogsCheckReport />}

                {showTokenForm && (
                    <div className="mt-2 flex flex-col gap-3">
                        {canUseServerAccount && !connection && (
                            <>
                                <button className="btn btn-primary btn-sm self-start" disabled={isBusy} onClick={() => connect({ source: 'server' })}>
                                    {t('discogsAccount.useServer')}
                                </button>
                                <p className="text-xs text-base-content/50">{t('discogsAccount.orOwn')}</p>
                            </>
                        )}
                        <label className="form-control w-full">
                            <span className="label-text mb-1">{t('discogsAccount.tokenLabel')}</span>
                            <input
                                type="password"
                                autoComplete="off"
                                className="input input-bordered input-sm w-full"
                                value={token}
                                onChange={e => setToken(e.target.value)}
                                disabled={isBusy}
                            />
                            <a
                                className="link text-xs mt-1"
                                href="https://www.discogs.com/settings/developers"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t('discogsAccount.tokenHelp')}
                            </a>
                        </label>
                        <button
                            className="btn btn-primary btn-sm self-start"
                            disabled={isBusy || !token.trim()}
                            onClick={() => connect({ source: 'own', token })}
                        >
                            {isBusy && <span className="loading loading-spinner loading-xs"></span>}
                            {t('discogsAccount.connect')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiscogsSettings;
