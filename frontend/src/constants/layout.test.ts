import { describe, expect, it } from 'vitest';
import { CENTERED_CONTENT_CLASS, contentWidthClass } from './layout';

describe('content width', () => {
    it('fills the viewport when wide screen mode is on', () => {
        expect(contentWidthClass(true)).toBe('');
    });

    it('caps the content width when wide screen mode is off', () => {
        expect(contentWidthClass(false)).toBe(CENTERED_CONTENT_CLASS);
        expect(CENTERED_CONTENT_CLASS).toContain('max-w-250');
    });
});
