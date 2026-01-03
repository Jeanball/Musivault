import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { AdminUser } from '../types/admin.types';
import { toastService } from '../utils/toast';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Verify admin access and fetch users
    useEffect(() => {
        const verifyAndFetch = async () => {
            try {
                // Verify current user is admin
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

                // Get current user ID
                const { data: allUsers } = await axios.get<AdminUser[]>('/api/users', {
                    withCredentials: true,
                });

                // Find current user by username
                const currentUser = allUsers.find(
                    (u) => u.username === verifyData.user
                );
                if (currentUser) {
                    setCurrentUserId(currentUser._id);
                }

                setUsers(allUsers);
            } catch (error) {
                console.error('Error fetching users:', error);
                toastService.error(t('admin.accessDenied'));
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };

        verifyAndFetch();
    }, [navigate]);

    // Filtered and sorted users (alphabetical A-Z, filtered by search)
    const filteredUsers = useMemo(() => {
        return users
            .filter((u) => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                    u.username.toLowerCase().includes(query) ||
                    u.email.toLowerCase().includes(query)
                );
            })
            .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
    }, [users, searchQuery]);

    // Delete user
    const handleDeleteUser = async (userId: string, username: string) => {
        if (userId === currentUserId) {
            toastService.error(t('admin.cannotDeleteSelf'));
            return;
        }

        if (!confirm(t('admin.confirmDeleteUser', { username }))) {
            return;
        }

        try {
            await axios.delete(`/api/users/${userId}`, { withCredentials: true });
            setUsers(users.filter((u) => u._id !== userId));
            toastService.success(t('admin.userDeleted', { username }));
        } catch (error) {
            console.error('Error deleting user:', error);
            toastService.error(t('admin.errorDeleting'));
        }
    };

    // Toggle admin status
    const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean, username: string) => {
        if (userId === currentUserId) {
            toastService.error(t('admin.cannotModifySelf'));
            return;
        }

        try {
            await axios.put(
                `/api/users/${userId}`,
                { isAdmin: !currentIsAdmin },
                { withCredentials: true }
            );

            setUsers(
                users.map((u) =>
                    u._id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
                )
            );

            toastService.success(
                !currentIsAdmin ? t('admin.nowAdmin', { username }) : t('admin.nowUser', { username })
            );
        } catch (error) {
            console.error('Error updating user:', error);
            toastService.error(t('admin.errorUpdating'));
        }
    };

    // Reset user password
    const handleResetPassword = async (userId: string, username: string) => {
        const newPassword = prompt(t('admin.enterNewPassword', { username }));
        if (!newPassword) return;

        if (newPassword.length < 6) {
            toastService.error(t('settings.passwordTooShort'));
            return;
        }

        try {
            await axios.put(
                `/api/users/${userId}`,
                { password: newPassword },
                { withCredentials: true }
            );
            toastService.success(t('admin.passwordUpdatedFor', { username }));
        } catch (error) {
            console.error('Error updating password:', error);
            toastService.error(t('admin.failedUpdatePassword'));
        }
    };

    // Copy public collection link
    const handleCopyPublicLink = (publicShareId: string, username: string) => {
        const url = `${window.location.origin}/collection/${publicShareId}`;
        navigator.clipboard.writeText(url).then(() => {
            toastService.success(t('admin.publicLinkCopied', { username }));
        }).catch(() => {
            toastService.error(t('admin.failedCopyLink'));
        });
    };

    // Stats
    const totalUsers = users.length;
    const totalAdmins = users.filter((u) => u.isAdmin).length;
    const totalAlbums = users.reduce((sum, u) => sum + (u.albumCount || 0), 0);
    const publicCollections = users.filter((u) => u.isPublic).length;

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Format date short (for mobile)
    const formatDateShort = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(i18n.language, {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
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
                <h1 className="text-3xl font-bold">{t('admin.title')}</h1>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat bg-base-200 rounded-box shadow">
                    <div className="stat-figure text-primary hidden sm:block">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                        </svg>
                    </div>
                    <div className="stat-title text-xs sm:text-sm">{t('admin.totalUsers')}</div>
                    <div className="stat-value text-primary text-2xl sm:text-3xl">{totalUsers}</div>
                </div>

                <div className="stat bg-base-200 rounded-box shadow">
                    <div className="stat-figure text-secondary hidden sm:block">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                        </svg>
                    </div>
                    <div className="stat-title text-xs sm:text-sm">{t('admin.admins')}</div>
                    <div className="stat-value text-secondary text-2xl sm:text-3xl">{totalAdmins}</div>
                </div>

                <div className="stat bg-base-200 rounded-box shadow">
                    <div className="stat-figure text-accent hidden sm:block">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
                            />
                        </svg>
                    </div>
                    <div className="stat-title text-xs sm:text-sm">{t('admin.totalAlbums')}</div>
                    <div className="stat-value text-accent text-2xl sm:text-3xl">{totalAlbums}</div>
                </div>

                <div className="stat bg-base-200 rounded-box shadow">
                    <div className="stat-figure text-info hidden sm:block">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <div className="stat-title text-xs sm:text-sm">{t('admin.publicCollections')}</div>
                    <div className="stat-value text-info text-2xl sm:text-3xl">{publicCollections}</div>
                </div>
            </div>

            {/* Users Management */}
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                        <h2 className="card-title">{t('admin.userManagement')}</h2>
                        {/* Search */}
                        <div className="form-control w-full sm:w-64">
                            <div className="input-group">
                                <input
                                    type="text"
                                    placeholder={t('admin.searchUsers')}
                                    className="input input-bordered input-sm w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => setSearchQuery('')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>{t('auth.username')}</th>
                                    <th>{t('auth.email')}</th>
                                    <th>{t('admin.role')}</th>
                                    <th>{t('admin.albumCount')}</th>
                                    <th>{t('admin.collectionStatus')}</th>
                                    <th>{t('admin.lastAdded')}</th>
                                    <th>{t('admin.created')}</th>
                                    <th>{t('admin.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user._id} className={user._id === currentUserId ? 'bg-primary/10' : ''}>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="avatar placeholder">
                                                    <div className="bg-neutral text-neutral-content rounded-full w-8">
                                                        <span className="text-sm">
                                                            {user.username.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="font-medium">{user.username}</span>
                                                {user._id === currentUserId && (
                                                    <span className="badge badge-primary badge-sm">{t('admin.you')}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            {user.isAdmin ? (
                                                <span className="badge badge-success gap-1">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-3 w-3"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                    {t('admin.admin')}
                                                </span>
                                            ) : (
                                                <span className="badge badge-ghost">{t('admin.user')}</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="badge badge-neutral">{user.albumCount || 0}</div>
                                        </td>
                                        <td>
                                            {user.isPublic ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="badge badge-info badge-sm gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {t('admin.public')}
                                                    </span>
                                                    <button
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() => handleCopyPublicLink(user.publicShareId, user.username)}
                                                        title={t('admin.copyPublicLink')}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="badge badge-ghost badge-sm">{t('admin.private')}</span>
                                            )}
                                        </td>
                                        <td>
                                            {user.lastAlbumAdded ? formatDate(user.lastAlbumAdded) : <span className="text-gray-400 italic">{t('admin.none')}</span>}
                                        </td>
                                        <td>{formatDate(user.createdAt)}</td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    onClick={() => handleResetPassword(user._id, user.username)}
                                                    title={t('settings.changePassword')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    onClick={() => handleToggleAdmin(user._id, user.isAdmin, user.username)}
                                                    disabled={user._id === currentUserId}
                                                    title={user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                                                >
                                                    {user.isAdmin ? (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            className="h-4 w-4"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            className="h-4 w-4"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                                            />
                                                        </svg>
                                                    )}
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-ghost text-error"
                                                    onClick={() => handleDeleteUser(user._id, user.username)}
                                                    disabled={user._id === currentUserId}
                                                    title={t('admin.deleteUser')}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-3">
                        {filteredUsers.map((user) => (
                            <div
                                key={user._id}
                                className={`card bg-base-100 shadow ${user._id === currentUserId ? 'ring-2 ring-primary' : ''}`}
                            >
                                <div className="card-body p-4">
                                    {/* Header row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="avatar placeholder">
                                                <div className="bg-neutral text-neutral-content rounded-full w-10">
                                                    <span className="text-lg">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-bold flex items-center gap-1">
                                                    {user.username}
                                                    {user._id === currentUserId && (
                                                        <span className="badge badge-primary badge-xs">{t('admin.you')}</span>
                                                    )}
                                                </div>
                                                <div className="text-sm opacity-70">{user.email}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {user.isAdmin ? (
                                                <span className="badge badge-success badge-sm">{t('admin.admin')}</span>
                                            ) : (
                                                <span className="badge badge-ghost badge-sm">{t('admin.user')}</span>
                                            )}
                                            {user.isPublic ? (
                                                <span className="badge badge-info badge-sm">{t('admin.public')}</span>
                                            ) : (
                                                <span className="badge badge-ghost badge-sm">{t('admin.private')}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-base-300">
                                        <div className="flex gap-4">
                                            <div>
                                                <span className="opacity-70">{t('admin.albumCount')}: </span>
                                                <span className="font-medium">{user.albumCount || 0}</span>
                                            </div>
                                            <div>
                                                <span className="opacity-70">{t('admin.lastAdded')}: </span>
                                                <span className="font-medium">
                                                    {user.lastAlbumAdded ? formatDateShort(user.lastAlbumAdded) : t('admin.none')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions row */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-300">
                                        <div className="text-xs opacity-50">
                                            {t('admin.joined')} {formatDateShort(user.createdAt)}
                                        </div>
                                        <div className="flex gap-1">
                                            {user.isPublic && (
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    onClick={() => handleCopyPublicLink(user.publicShareId, user.username)}
                                                    title={t('admin.copyPublicLink')}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-xs btn-ghost"
                                                onClick={() => handleResetPassword(user._id, user.username)}
                                                title={t('settings.changePassword')}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                            </button>
                                            <button
                                                className="btn btn-xs btn-ghost"
                                                onClick={() => handleToggleAdmin(user._id, user.isAdmin, user.username)}
                                                disabled={user._id === currentUserId}
                                                title={user.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                                            >
                                                {user.isAdmin ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                className="btn btn-xs btn-ghost text-error"
                                                onClick={() => handleDeleteUser(user._id, user.username)}
                                                disabled={user._id === currentUserId}
                                                title={t('admin.deleteUser')}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty state */}
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-8 opacity-50">
                            {searchQuery ? t('admin.noUsersMatch') : t('admin.noUsersFound')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
