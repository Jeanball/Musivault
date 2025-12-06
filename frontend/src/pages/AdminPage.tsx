import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import type { AdminUser } from '../types/admin.types';
import { toastService } from '../utils/toast';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');

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
                toastService.error('Accès refusé ou erreur serveur');
                navigate('/app');
            } finally {
                setIsLoading(false);
            }
        };

        verifyAndFetch();
    }, [navigate]);

    // Delete user
    const handleDeleteUser = async (userId: string, username: string) => {
        if (userId === currentUserId) {
            toastService.error('Vous ne pouvez pas vous supprimer vous-même');
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ?`)) {
            return;
        }

        try {
            await axios.delete(`/api/users/${userId}`, { withCredentials: true });
            setUsers(users.filter((u) => u._id !== userId));
            toastService.success(`Utilisateur "${username}" supprimé`);
        } catch (error) {
            console.error('Error deleting user:', error);
            toastService.error('Erreur lors de la suppression');
        }
    };

    // Toggle admin status
    const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean, username: string) => {
        if (userId === currentUserId) {
            toastService.error('Vous ne pouvez pas modifier votre propre statut admin');
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
                `${username} est maintenant ${!currentIsAdmin ? 'admin' : 'utilisateur standard'}`
            );
        } catch (error) {
            console.error('Error updating user:', error);
            toastService.error('Erreur lors de la mise à jour');
        }
    };

    // Stats
    const totalUsers = users.length;
    const totalAdmins = users.filter((u) => u.isAdmin).length;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newThisWeek = users.filter(
        (u) => new Date(u.createdAt) > oneWeekAgo
    ).length;

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-CA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
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
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            </div>

            {/* Stats */}
            <div className="stats stats-vertical lg:stats-horizontal shadow w-full bg-base-200">
                <div className="stat">
                    <div className="stat-figure text-primary">
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
                    <div className="stat-title">Total Users</div>
                    <div className="stat-value text-primary">{totalUsers}</div>
                </div>

                <div className="stat">
                    <div className="stat-figure text-secondary">
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
                    <div className="stat-title">Admins</div>
                    <div className="stat-value text-secondary">{totalAdmins}</div>
                </div>

                <div className="stat">
                    <div className="stat-figure text-accent">
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
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            />
                        </svg>
                    </div>
                    <div className="stat-title">New This Week</div>
                    <div className="stat-value text-accent">{newThisWeek}</div>
                </div>
            </div>

            {/* Users Table */}
            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title mb-4">User Management</h2>

                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Admin</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
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
                                                    <span className="badge badge-primary badge-sm">You</span>
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
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="badge badge-ghost">User</span>
                                            )}
                                        </td>
                                        <td>{formatDate(user.createdAt)}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn btn-xs btn-ghost"
                                                    onClick={() => handleToggleAdmin(user._id, user.isAdmin, user.username)}
                                                    disabled={user._id === currentUserId}
                                                    title={user.isAdmin ? 'Remove admin' : 'Make admin'}
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
                                                    title="Delete user"
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
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
