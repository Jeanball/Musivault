/**
 * Discogs API utilities
 * Shared helpers for authentication, rate limiting, and error handling
 */

import axios, { AxiosError } from 'axios';
import { Response } from 'express';

// ===== Constants =====

export const DISCOGS_BASE_URL = 'https://api.discogs.com';
export const DISCOGS_HEADERS = { 'User-Agent': 'Musivault/1.0' };
export const RATE_LIMIT_MS = 1100;

// ===== Authentication =====

export interface DiscogsAuthParams {
    key: string;
    secret: string;
}

/**
 * Get Discogs API authentication parameters from environment
 * @throws Error if credentials are not configured
 */
export function getAuthParams(): DiscogsAuthParams {
    const key = process.env.DISCOGS_KEY;
    const secret = process.env.DISCOGS_SECRET;

    if (!key || !secret) {
        throw new Error('Discogs API credentials not configured');
    }

    return { key, secret };
}

/**
 * Check if Discogs credentials are available (non-throwing version)
 */
export function hasCredentials(): boolean {
    return !!(process.env.DISCOGS_KEY && process.env.DISCOGS_SECRET);
}

// ===== Rate Limiting =====

/**
 * Delay execution for rate limiting
 */
export const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

// ===== API Request Wrapper =====

/**
 * Make a request to the Discogs API with authentication and proper headers
 */
export async function discogsRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options: { useTokenAuth?: boolean; applyRateLimit?: boolean } = {}
): Promise<T> {
    const { useTokenAuth = false, applyRateLimit = false } = options;

    if (applyRateLimit) {
        await delay(RATE_LIMIT_MS);
    }

    const url = endpoint.startsWith('http') ? endpoint : `${DISCOGS_BASE_URL}${endpoint}`;

    if (useTokenAuth) {
        // Token-based auth (for some endpoints)
        const secret = process.env.DISCOGS_SECRET;
        if (!secret) {
            throw new Error('Discogs API secret not configured');
        }
        const response = await axios.get<T>(url, {
            headers: {
                ...DISCOGS_HEADERS,
                'Authorization': `Discogs token=${secret}`
            },
            params
        });
        return response.data;
    } else {
        // Key/secret auth (default)
        const auth = getAuthParams();
        const response = await axios.get<T>(url, {
            headers: DISCOGS_HEADERS,
            params: { ...params, key: auth.key, secret: auth.secret }
        });
        return response.data;
    }
}

// ===== Error Handling =====

/**
 * Standard error handler for Discogs API errors in controllers
 */
export function handleDiscogsError(
    error: unknown,
    res: Response,
    context: string
): void {
    console.error(`Error ${context}:`, error);

    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.response?.status === 429) {
            res.status(429).json({
                message: 'Too many requests! Please wait about 30 seconds before trying again.'
            });
            return;
        }

        if (axiosError.response?.status === 404) {
            res.status(404).json({ message: 'Not found on Discogs.' });
            return;
        }
    }

    if (error instanceof Error && error.message.includes('not configured')) {
        res.status(500).json({ message: 'Server configuration error.' });
        return;
    }

    res.status(500).json({ message: 'Operation failed.' });
}

// ===== String Helpers =====

/**
 * Clean album title by removing artist prefix
 * Discogs returns titles as "Artist - Album Title"
 */
export function cleanAlbumTitle(title: string): string {
    const separator = ' - ';
    const separatorIndex = title.indexOf(separator);
    if (separatorIndex !== -1) {
        return title.substring(separatorIndex + separator.length).trim();
    }
    return title;
}

/**
 * Normalize a string for comparison: lowercase, remove special chars, normalize spaces
 */
export function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate similarity between two strings (0-1 score)
 * Uses word overlap percentage
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const norm1 = normalizeString(str1);
    const norm2 = normalizeString(str2);

    if (norm1 === norm2) return 1;
    if (!norm1 || !norm2) return 0;

    const words1 = norm1.split(' ');
    const words2Set = new Set(norm2.split(' '));

    let matches = 0;
    for (const word of words1) {
        if (words2Set.has(word)) matches++;
    }

    return matches / words1.length;
}

/**
 * Check if artist name matches (handles variations like "Artist (2)")
 */
export function artistMatches(searchArtist: string, resultArtist: string): boolean {
    const normSearch = normalizeString(searchArtist);
    const normResult = normalizeString(resultArtist.replace(/\(\d+\)/g, ''));

    return normResult.includes(normSearch) ||
        normSearch.includes(normResult) ||
        calculateSimilarity(normSearch, normResult) >= 0.8;
}
