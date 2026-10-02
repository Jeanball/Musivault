import { describe, it, expect } from 'vitest';
import { compareVersions, parseChangelog } from './useWhatsNew';

describe('useWhatsNew - compareVersions', () => {
    it('should compare major.minor.patch versions correctly', () => {
        expect(compareVersions('1.14.0', '1.15.0')).toBe(-1);
        expect(compareVersions('1.15.0', '1.14.0')).toBe(1);
        expect(compareVersions('1.15.0', '1.15.0')).toBe(0);
    });

    it('should compare major.minor version strings (without patch)', () => {
        expect(compareVersions('1.14', '1.15.0')).toBe(-1);
        expect(compareVersions('1.15', '1.14.0')).toBe(1);
        expect(compareVersions('1.15', '1.15.0')).toBe(0);
    });

    it('should strip leading "v" or "V" prefixes', () => {
        expect(compareVersions('v1.14.0', '1.15.0')).toBe(-1);
        expect(compareVersions('V1.15.0', 'v1.14.0')).toBe(1);
        expect(compareVersions('v1.15.0', '1.15.0')).toBe(0);
    });

    it('should compare prerelease versions', () => {
        expect(compareVersions('1.15.0-beta.1', '1.15.0')).toBe(-1);
        expect(compareVersions('1.15.0', '1.15.0-beta.1')).toBe(1);
        expect(compareVersions('1.15.0-alpha.1', '1.15.0-beta.1')).toBe(-1);
    });
});

describe('useWhatsNew - parseChangelog', () => {
    it('should parse version blocks and sections correctly', () => {
        const markdown = `
# Changelog

## [1.15.0] - 2026-10-02

### What's New
- Feature A
- Feature B

### Bug Fixes
- Fix X

---

## [1.14.0] - 2026-07-31

### What's New
- Feature C
`;
        const entries = parseChangelog(markdown);
        expect(entries.length).toBe(2);
        expect(entries[0].version).toBe('1.15.0');
        expect(entries[0].date).toBe('2026-10-02');
        expect(entries[0].sections.length).toBe(2);
        expect(entries[0].sections[0].type).toBe("What's New");
        expect(entries[0].sections[1].type).toBe('Bug Fixes');

        expect(entries[1].version).toBe('1.14.0');
    });
});
