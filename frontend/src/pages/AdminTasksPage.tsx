import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { AdminTask } from '../types/admin.types';
import { toastService } from '../utils/toast';
import AdminTabs from '../components/Admin/AdminTabs';

const AdminTasksPage: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [activeTaskProgress, setActiveTaskProgress] = useState('');
    const [activeTaskSummary, setActiveTaskSummary] = useState('');
    const [activeTaskAbortController, setActiveTaskAbortController] = useState<AbortController | null>(null);

    const loadTasks = async () => {
        const { data } = await axios.get<AdminTask[]>('/api/users/admin/tasks', {
            withCredentials: true,
        });
        setTasks(data);
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
                await loadTasks();
            } catch (error) {
                console.error('Error loading admin tasks:', error);
                toastService.error(t('admin.accessDenied'));
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };

        verifyAndLoad();
    }, [navigate]);

    const getTaskName = (taskId: string) => {
        switch (taskId) {
            case 'refresh-prices':
                return t('admin.tasks.items.refreshPrices.name', 'Refresh Prices');
            default:
                return taskId;
        }
    };

    const getTaskDescription = (taskId: string) => {
        switch (taskId) {
            case 'refresh-prices':
                return t(
                    'admin.tasks.items.refreshPrices.description',
                    'Refresh cached Discogs prices for every collection item, even when the cache is still fresh.'
                );
            default:
                return t('admin.tasks.defaultDescription', 'No description available yet.');
        }
    };

    const handleRunTask = async (task: AdminTask) => {
        setActiveTaskId(task.id);
        setActiveTaskProgress('');
        setActiveTaskSummary('');

        const abortController = new AbortController();
        setActiveTaskAbortController(abortController);

        try {
            const response = await fetch(`/api/users/admin/tasks/${task.id}/run`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                signal: abortController.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error('Task failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'progress') {
                            setActiveTaskProgress(`${event.current}/${event.total} - ${event.artist} - ${event.title}`);
                        } else if (event.type === 'complete') {
                            const summary = event.message || t('admin.tasks.runSuccess', 'Task completed successfully.');
                            setActiveTaskSummary(summary);
                            toastService.success(summary);
                        } else if (event.type === 'error') {
                            throw new Error(event.message || 'Task failed');
                        }
                    } catch (error) {
                        if (error instanceof SyntaxError) {
                            continue;
                        }
                        if (error instanceof Error) {
                            throw error;
                        }
                    }
                }
            }

            await loadTasks();
        } catch (error: any) {
            if (error.name === 'AbortError') {
                setActiveTaskSummary(t('admin.tasks.runCancelled', 'Task was cancelled.'));
                toastService.info(t('admin.tasks.runCancelled', 'Task was cancelled.'));
            } else {
                console.error(`Error running admin task "${task.id}":`, error);
                setActiveTaskSummary('');
                toastService.error(t('admin.tasks.runError', 'Failed to run task. Please try again.'));
            }
        } finally {
            setActiveTaskId(null);
            setActiveTaskProgress('');
            setActiveTaskAbortController(null);
        }
    };

    const formatDate = (value: string | null) => {
        if (!value) return t('admin.tasks.notRunYet', 'Not run yet');
        return new Date(value).toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (durationMs: number | null) => {
        if (durationMs === null) return t('admin.tasks.notAvailable', 'N/A');
        if (durationMs < 1000) return `${durationMs} ms`;

        const totalSeconds = Math.round(durationMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes === 0) return `${seconds}s`;
        return `${minutes}m ${seconds}s`;
    };

    const formatNextExecution = (task: AdminTask) => {
        if (!task.nextExecutionAt) return t('admin.tasks.onDemand', 'On demand');
        return formatDate(task.nextExecutionAt);
    };

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
                            <h2 className="card-title">{t('admin.tasks.tableTitle', 'Available Tasks')}</h2>
                            <p className="text-sm opacity-70">
                                {t('admin.tasks.tableSubtitle', 'Each task exposes a stable schedule view so we can add more jobs without redesigning the page.')}
                            </p>
                        </div>
                        <div className="badge badge-outline">{tasks.length} {t('admin.tasks.countLabel', 'tasks')}</div>
                    </div>

                    {(activeTaskId || activeTaskSummary) && (
                        <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-base-content/50">
                                {t('admin.tasks.liveStatus', 'Live status')}
                            </div>
                            {activeTaskId && (
                                <p className="mt-1 font-medium">
                                    {getTaskName(activeTaskId)} - {activeTaskProgress || t('admin.tasks.starting', 'Starting...')}
                                </p>
                            )}
                            {!activeTaskId && activeTaskSummary && (
                                <p className="mt-1 text-success font-medium">{activeTaskSummary}</p>
                            )}
                        </div>
                    )}

                    <div className="hidden lg:block overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>{t('admin.tasks.columns.task', 'Task')}</th>
                                    <th>{t('admin.tasks.columns.status', 'Status')}</th>
                                    <th>{t('admin.tasks.columns.interval', 'Interval')}</th>
                                    <th>{t('admin.tasks.columns.lastExecution', 'Last Execution')}</th>
                                    <th>{t('admin.tasks.columns.lastDuration', 'Last Duration')}</th>
                                    <th>{t('admin.tasks.columns.nextExecution', 'Next Execution')}</th>
                                    <th>{t('admin.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => (
                                    <tr key={task.id}>
                                        <td className="min-w-[320px]">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{getTaskName(task.id)}</span>
                                                </div>
                                                <p className="text-sm text-base-content/70">{getTaskDescription(task.id)}</p>
                                            </div>
                                        </td>
                                        <td>
                                            {task.lastStatus ? (
                                                <span className={`badge badge-sm ${task.lastStatus === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                    {task.lastStatus === 'success' ? t('common.success', 'Success') : t('common.failed', 'Failed')}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-base-content/50">{t('admin.tasks.notAvailable', 'N/A')}</span>
                                            )}
                                        </td>
                                        <td>{task.intervalLabel}</td>
                                        <td>{formatDate(task.lastExecutionAt)}</td>
                                        <td>{formatDuration(task.lastDurationMs)}</td>
                                        <td>{formatNextExecution(task)}</td>
                                        <td>
                                            {activeTaskId === task.id ? (
                                                <button
                                                    className="btn btn-error btn-sm w-28 flex-nowrap"
                                                    onClick={() => activeTaskAbortController?.abort()}
                                                >
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                    {t('common.cancel', 'Cancel')}
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-primary btn-sm w-28 flex-nowrap"
                                                    onClick={() => handleRunTask(task)}
                                                    disabled={activeTaskId !== null}
                                                >
                                                    {t('admin.tasks.runButton', 'Run Task')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="lg:hidden space-y-3">
                        {tasks.map((task) => (
                            <div key={task.id} className="rounded-box bg-base-100 border border-base-300 p-4 space-y-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{getTaskName(task.id)}</h3>
                                    </div>
                                    <p className="text-sm text-base-content/70">{getTaskDescription(task.id)}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-base-content/50">{t('admin.tasks.columns.status', 'Status')}</div>
                                        <div>
                                            {task.lastStatus ? (
                                                <span className={`badge badge-sm ${task.lastStatus === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                    {task.lastStatus === 'success' ? t('common.success', 'Success') : t('common.failed', 'Failed')}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-base-content/50">{t('admin.tasks.notAvailable', 'N/A')}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-base-content/50">{t('admin.tasks.columns.interval', 'Interval')}</div>
                                        <div>{task.intervalLabel}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-base-content/50">{t('admin.tasks.columns.lastExecution', 'Last Execution')}</div>
                                        <div>{formatDate(task.lastExecutionAt)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-base-content/50">{t('admin.tasks.columns.lastDuration', 'Last Duration')}</div>
                                        <div>{formatDuration(task.lastDurationMs)}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="text-xs uppercase tracking-wide text-base-content/50">{t('admin.tasks.columns.nextExecution', 'Next Execution')}</div>
                                        <div>{formatNextExecution(task)}</div>
                                    </div>
                                </div>

                                {activeTaskId === task.id ? (
                                    <button
                                        className="btn btn-error btn-sm w-full"
                                        onClick={() => activeTaskAbortController?.abort()}
                                    >
                                        <span className="loading loading-spinner loading-xs"></span>
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-primary btn-sm w-full"
                                        onClick={() => handleRunTask(task)}
                                        disabled={activeTaskId !== null}
                                    >
                                        {t('admin.tasks.runButton', 'Run Task')}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminTasksPage;
