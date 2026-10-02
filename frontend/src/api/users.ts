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

export async function updateUser(
    userId: string,
    patch: { isAdmin?: boolean; password?: string }
): Promise<void> {
    await client.put(`/users/${userId}`, patch);
}

export async function deleteUser(userId: string): Promise<void> {
    await client.delete(`/users/${userId}`);
}
