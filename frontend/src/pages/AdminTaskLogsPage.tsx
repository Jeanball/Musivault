import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { AdminTaskLog } from '../types/admin.types';
import { toastService } from '../utils/toast';
import AdminTabs from '../components/Admin/AdminTabs';

const AdminTaskLogsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [logs, setLogs] = useState<AdminTaskLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [filterTaskId, setFilterTaskId] = useState<string>('');

    const getTaskName = (taskId: string) => {
        switch (taskId) {
            case 'refresh-prices':
                return t('admin.tasks.items.refreshPrices.name', 'Refresh Prices');
            case 'refresh-exchange-rates':
                return t('admin.tasks.items.refreshExchangeRates.name', 'Update Exchange Rates');
            default:
                return taskId;
        }
    };

    const loadLogs = async (taskId?: string) => {
        const params: Record<string, string> = { limit: '50' };
        if (taskId) params.taskId = taskId;

        const { data } = await axios.get<AdminTaskLog[]>('/api/admin/tasks/logs', {
            withCredentials: true,
            params,
        });
        setLogs(data);
    };

    useEffect(() => {
        const verifyAndLoad = async () => {
            try {
                const { data: verifyData } = await axios.post(
                    '/api/auth/verify',
                    {},
                    { withCredentials: true }
                );

                if (!verifyData.status || !verifyData.isAdmin) {
                    navigate('/app');
                    return;
                }

                setIsAdmin(true);
                await loadLogs();
            } catch (error) {
                console.error('Error loading task logs:', error);
                toastService.error(t('admin.accessDenied'));
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };

        verifyAndLoad();
    }, [navigate]);

    const handleFilterChange = async (taskId: string) => {
        setFilterTaskId(taskId);
        await loadLogs(taskId || undefined);
    };

    const formatDate = (value: string) => {
        return new Date(value).toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatDuration = (durationMs: number) => {
        if (durationMs < 1000) return `${durationMs} ms`;

        const totalSeconds = Math.round(durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes === 0) return `${seconds}s`;
        return `${minutes}m ${seconds}s`;
    };

    // Get unique task IDs for the filter dropdown
    const uniqueTaskIds = [...new Set(logs.map(log => log.taskId))];

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                    </svg>
                    <div>
                        <h1 className="text-3xl font-bold">{t('admin.tasks.pageTitle', 'Task Center')}</h1>
                        <p className="text-sm text-base-content/70">
                            {t('admin.tasks.pageSubtitle', 'Run and monitor admin jobs from one place.')}
                        </p>
                    </div>
                </div>
                <AdminTabs />
            </div>

            <div className="card bg-base-200 shadow-xl">
                <div className="card-body p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="card-title">{t('admin.logs.pageTitle', 'Execution Logs')}</h2>
                            <p className="text-sm opacity-70">
                                {t('admin.logs.pageSubtitle', 'Full history of automated and manual task executions.')}
                            </p>
                        </div>
                        <select
                            className="select select-bordered select-sm w-full max-w-xs"
                            value={filterTaskId}
                            onChange={(e) => handleFilterChange(e.target.value)}
                        >
                            <option value="">{t('admin.logs.filterAll', 'All tasks')}</option>
                            {uniqueTaskIds.map((id) => (
                                <option key={id} value={id}>{getTaskName(id)}</option>
                            ))}
                        </select>
                    </div>

                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-base-content/50">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-12 w-12 mx-auto mb-3 opacity-30"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <p>{t('admin.logs.noLogs', 'No execution logs yet.')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="table table-zebra">
                                    <thead>
                                        <tr>
                                            <th>{t('admin.logs.columns.task', 'Task')}</th>
                                            <th>{t('admin.logs.columns.trigger', 'Trigger')}</th>
                                            <th>{t('admin.logs.columns.status', 'Status')}</th>
                                            <th>{t('admin.logs.columns.executedAt', 'Executed At')}</th>
                                            <th>{t('admin.logs.columns.duration', 'Duration')}</th>
                                            <th>{t('admin.logs.columns.details', 'Details')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={log._id}>
                                                <td className="font-medium">{getTaskName(log.taskId)}</td>
                                                <td>
                                                    <span className={`badge badge-sm ${log.trigger === 'auto' ? 'badge-info' : 'badge-neutral'}`}>
                                                        {log.trigger === 'auto'
                                                            ? t('admin.logs.triggerAuto', 'Auto')
                                                            : t('admin.logs.triggerManual', 'Manual')
                                                        }
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-sm ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                        {log.status === 'success' ? t('common.success', 'Success') : t('common.failed', 'Failed')}
                                                    </span>
                                                </td>
                                                <td>{formatDate(log.executedAt)}</td>
                                                <td>{formatDuration(log.durationMs)}</td>
                                                <td className="max-w-xs truncate text-sm text-base-content/70">
                                                    {log.details || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="lg:hidden space-y-3">
                                {logs.map((log) => (
                                    <div key={log._id} className="rounded-box bg-base-100 border border-base-300 p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">{getTaskName(log.taskId)}</span>
                                            <div className="flex gap-1">
                                                <span className={`badge badge-sm ${log.trigger === 'auto' ? 'badge-info' : 'badge-neutral'}`}>
                                                    {log.trigger === 'auto'
                                                        ? t('admin.logs.triggerAuto', 'Auto')
                                                        : t('admin.logs.triggerManual', 'Manual')
                                                    }
                                                </span>
                                                <span className={`badge badge-sm ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                    {log.status === 'success' ? t('common.success', 'Success') : t('common.failed', 'Failed')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-base-content/50">
                                                    {t('admin.logs.columns.executedAt', 'Executed At')}
                                                </div>
                                                <div>{formatDate(log.executedAt)}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs uppercase tracking-wide text-base-content/50">
                                                    {t('admin.logs.columns.duration', 'Duration')}
                                                </div>
                                                <div>{formatDuration(log.durationMs)}</div>
                                            </div>
                                        </div>
                                        {log.details && (
                                            <p className="text-sm text-base-content/70 break-words">{log.details}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminTaskLogsPage;
