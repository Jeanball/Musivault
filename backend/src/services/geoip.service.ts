/**
 * Coarse IP geolocation, used as the fallback when the browser's Geolocation
 * API is unavailable or refused. Accuracy is city-level at best and wrong
 * behind a VPN, so the result is always presented as approximate.
 *
 * ipapi.co allows 1000 requests/day without a key; IPAPI_KEY raises that.
 */

import axios from 'axios';
import { isPrivateIp } from '../utils/geo.utils';
import { logger } from '../config/logger.config';

const IPAPI_TIMEOUT_MS = 5000;

export interface IpLocation {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
}

interface IpapiResponse {
  latitude?: number;
  longitude?: number;
  city?: string;
  country_name?: string;
  error?: boolean;
  reason?: string;
}

/**
 * Resolves an IP to an approximate position, or null when that isn't possible
 * — private/loopback addresses, quota exhaustion, provider outage. Never
 * throws: the caller treats an unknown location as a normal, expected state.
 */
export async function lookupIp(ip?: string | null): Promise<IpLocation | null> {
  if (isPrivateIp(ip)) return null;

  try {
    const { data } = await axios.get<IpapiResponse>(`https://ipapi.co/${ip}/json/`, {
      params: process.env.IPAPI_KEY ? { key: process.env.IPAPI_KEY } : undefined,
      timeout: IPAPI_TIMEOUT_MS,
      headers: { 'User-Agent': 'Musivault/1.0' },
    });

    // ipapi.co answers 200 with {error: true} for quota and bad-address errors.
    if (data.error || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      logger.warn({ reason: data.reason }, 'IP geolocation returned no position');
      return null;
    }

    return {
      lat: data.latitude,
      lon: data.longitude,
      city: data.city,
      country: data.country_name,
    };
  } catch (error) {
    logger.warn({ err: error }, 'IP geolocation lookup failed');
    return null;
  }
}
