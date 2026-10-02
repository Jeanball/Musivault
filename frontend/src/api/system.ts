import { client } from './client';
import type { VersionInfo } from '../types/system.types';

export async function getVersion(): Promise<VersionInfo> {
    const { data } = await client.get<VersionInfo>('/version');
    return data;
}
