import { client } from './client';
import type { AdminUser } from '../types/admin.types';

export async function updateProfile(payload: {
    displayName: string;
    username: string;
    email: string;
}): Promise<void> {
    await client.put('/users/profile', payload);
}

export async function updatePassword(payload: {
    currentPassword: string;
    newPassword: string;
}): Promise<void> {
    await client.put('/users/password', payload);
}

// Admin-only below: these sit behind requireAdmin on the backend.

export async function getUsers(): Promise<AdminUser[]> {
    const { data } = await client.get<AdminUser[]>('/users');
    return data;
}

/** Creates a local account; the server refuses a taken username or email and a password under 6 characters. */
export async function createUser(payload: {
    username: string;
    email: string;
    password: string;
    isAdmin: boolean;
}): Promise<void> {
    await client.post('/users/admin/create', payload);
}

/** Only the fields present are changed. */
export async function updateUser(
    userId: string,
    patch: { username?: string; email?: string; isAdmin?: boolean; password?: string }
): Promise<void> {
    await client.put(`/users/${userId}`, patch);
}

export async function deleteUser(userId: string): Promise<void> {
    await client.delete(`/users/${userId}`);
}
