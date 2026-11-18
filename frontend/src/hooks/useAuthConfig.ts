import { useEffect, useState } from 'react';
import { getAuthConfig } from '../api/auth';
import type { AuthConfig } from '../types/auth.types';

/**
 * Defaults are the safe fallback while the request is in flight or when the
 * server cannot be reached: no SSO button, and signup stays reachable so a
 * transient failure never locks the only way to create the first account.
 */
const FALLBACK: AuthConfig = {
    signupEnabled: true,
    oidcEnabled: false,
    oidcProviderName: 'SSO'
};

export function useAuthConfig(): { config: AuthConfig; loading: boolean } {
    const [config, setConfig] = useState<AuthConfig>(FALLBACK);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        getAuthConfig()
            .then(next => { if (active) setConfig(next); })
            .catch(() => { if (active) setConfig(FALLBACK); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    return { config, loading };
}
