import { useState, useEffect, useCallback } from 'react';

const LAST_SEEN_KEY = 'musivault_last_seen_version';

export interface ChangelogEntry {
    version: string;
    date: string;
    sections: {
        type: string;
        content: string;
    }[];
}

/**
 * Compare two semver versions (supports prereleases like 1.8.0-beta.1)
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 * Prereleases are considered older than their release (1.8.0-beta.1 < 1.8.0)
 */
export function compareVersions(a: string, b: string): number {
    const cleanA = a.replace(/^v/i, '').trim();
    const cleanB = b.replace(/^v/i, '').trim();

    // Split version and prerelease
    const [versionA, preA] = cleanA.split('-');
    const [versionB, preB] = cleanB.split('-');

    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);

    // Compare major.minor.patch
    for (let i = 0; i < 3; i++) {
        const numA = isNaN(partsA[i]) ? 0 : partsA[i] || 0;
        const numB = isNaN(partsB[i]) ? 0 : partsB[i] || 0;
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }

    // If versions are equal, compare prereleases
    // No prerelease > prerelease (1.8.0 > 1.8.0-beta.1)
    if (!preA && preB) return 1;
    if (preA && !preB) return -1;
    if (!preA && !preB) return 0;

    // Compare prerelease strings lexically
    return preA!.localeCompare(preB!);
}

/**
 * Parse CHANGELOG.md content into structured entries
 */
export function parseChangelog(content: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];

    // Match version blocks: ## [X.Y.Z] or ## [vX.Y.Z] or ## [X.Y] - YYYY-MM-DD
    const versionRegex = /## \[v?(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)\](?: - (\d{4}-\d{2}-\d{2}))?/g;
    const sections = content.split(versionRegex);

    // sections array: [preamble, version1, date1, content1, version2, date2, content2, ...]
    for (let i = 1; i < sections.length; i += 3) {
        const version = sections[i];
        const date = sections[i + 1] || '';
        const blockContent = sections[i + 2] || '';

        // Skip [Unreleased]
        if (version.toLowerCase() === 'unreleased') continue;

        const entry: ChangelogEntry = {
            version,
            date,
            sections: []
        };

        // Parse sections matching any ### Header
        const sectionRegex = /### (.*?)\n([\s\S]*?)(?=###|$)/g;
        let sectionMatch;

        while ((sectionMatch = sectionRegex.exec(blockContent)) !== null) {
            // Remove markdown bold syntax from the section header title
            const type = sectionMatch[1].replace(/\*\*/g, '').trim();
            const content = sectionMatch[2].trim();

            if (content) {
                entry.sections.push({ type, content });
            }
        }

        if (entry.sections.length > 0) {
            entries.push(entry);
        }
    }

    return entries;
}

export function useWhatsNew() {
    const [showModal, setShowModal] = useState(false);
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentVersion, setCurrentVersion] = useState('');

    const dismiss = useCallback(() => {
        if (currentVersion) {
            localStorage.setItem(LAST_SEEN_KEY, currentVersion);
        }
        setShowModal(false);
    }, [currentVersion]);

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                // Fetch current version from VERSION file
                const versionResponse = await fetch('/VERSION');
                if (!versionResponse.ok) {
                    setIsLoading(false);
                    return;
                }
                const appVersion = (await versionResponse.text()).trim();
                setCurrentVersion(appVersion);

                const lastSeenVersion = localStorage.getItem(LAST_SEEN_KEY);

                // If first visit ever, just set current version and don't show modal
                if (!lastSeenVersion) {
                    localStorage.setItem(LAST_SEEN_KEY, appVersion);
                    setIsLoading(false);
                    return;
                }

                // If already on latest (or newer), no need to show
                if (compareVersions(lastSeenVersion, appVersion) >= 0) {
                    setIsLoading(false);
                    return;
                }

                // Fetch and parse changelog
                const response = await fetch('/CHANGELOG.md');
                if (!response.ok) {
                    // Update last seen version to avoid getting stuck if changelog fails to load
                    localStorage.setItem(LAST_SEEN_KEY, appVersion);
                    setIsLoading(false);
                    return;
                }

                const content = await response.text();
                const allEntries = parseChangelog(content);

                // Only show the latest version (first entry in the parsed list)
                if (allEntries.length > 0 && compareVersions(allEntries[0].version, lastSeenVersion) > 0) {
                    setEntries([allEntries[0]]);
                    setShowModal(true);
                } else {
                    // If no relevant new entries found, update lastSeenVersion so it doesn't stay stuck on older version
                    localStorage.setItem(LAST_SEEN_KEY, appVersion);
                }
            } catch (error) {
                console.error('Error checking for updates:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkForUpdates();
    }, []);

    return {
        showModal,
        entries,
        dismiss,
        isLoading,
        currentVersion
    };
}

