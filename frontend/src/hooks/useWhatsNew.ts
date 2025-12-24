import { useState, useEffect } from 'react';

const LAST_SEEN_KEY = 'musivault_last_seen_version';

export interface ChangelogEntry {
    version: string;
    date: string;
    sections: {
        type: 'Added' | 'Changed' | 'Fixed' | 'Removed';
        items: string[];
    }[];
}

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }
    return 0;
}

/**
 * Parse CHANGELOG.md content into structured entries
 */
function parseChangelog(content: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];

    // Match version blocks: ## [X.Y.Z] - YYYY-MM-DD
    const versionRegex = /## \[(\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?/g;
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

        // Parse sections (### Added, ### Fixed, etc.)
        const sectionRegex = /### (Added|Changed|Fixed|Removed)\n([\s\S]*?)(?=###|$)/g;
        let sectionMatch;

        while ((sectionMatch = sectionRegex.exec(blockContent)) !== null) {
            const type = sectionMatch[1] as 'Added' | 'Changed' | 'Fixed' | 'Removed';
            const itemsText = sectionMatch[2];

            // Extract bullet points, excluding separator lines
            const items = itemsText
                .split('\n')
                .filter(line => line.trim().startsWith('-') && !line.trim().match(/^-+$/))
                .map(line => line.replace(/^-\s*/, '').trim())
                .filter(Boolean);

            if (items.length > 0) {
                entry.sections.push({ type, items });
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

                // If already on latest, no need to show
                if (compareVersions(lastSeenVersion, appVersion) >= 0) {
                    setIsLoading(false);
                    return;
                }

                // Fetch and parse changelog
                const response = await fetch('/CHANGELOG.md');
                if (!response.ok) {
                    setIsLoading(false);
                    return;
                }

                const content = await response.text();
                const allEntries = parseChangelog(content);

                // Only show the latest version (first entry in the parsed list)
                if (allEntries.length > 0 && compareVersions(allEntries[0].version, lastSeenVersion) > 0) {
                    setEntries([allEntries[0]]);
                    setShowModal(true);
                }
            } catch (error) {
                console.error('Error checking for updates:', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkForUpdates();
    }, []);

    const dismiss = () => {
        localStorage.setItem(LAST_SEEN_KEY, currentVersion);
        setShowModal(false);
    };

    return {
        showModal,
        entries,
        dismiss,
        isLoading,
        currentVersion
    };
}
