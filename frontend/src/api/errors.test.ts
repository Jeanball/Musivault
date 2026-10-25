import { describe, expect, it } from 'vitest';
import { ApiError, isServerUnavailable } from './errors';

describe('isServerUnavailable', () => {
    it('is true when the request never reached the server', () => {
        expect(isServerUnavailable(new ApiError({ status: 0, message: 'Network Error', isNetworkError: true }))).toBe(true);
    });

    it('is true for a server error, with or without a message', () => {
        expect(isServerUnavailable(new ApiError({ status: 500, message: 'x' }))).toBe(true);
        expect(isServerUnavailable(new ApiError({ status: 502, message: 'x', serverMessage: 'Bad gateway' }))).toBe(true);
    });

    it('is false for a rejection the user can act on', () => {
        expect(isServerUnavailable(new ApiError({ status: 401, message: 'x', serverMessage: 'Invalid credentials' }))).toBe(false);
        expect(isServerUnavailable(new ApiError({ status: 400, message: 'x' }))).toBe(false);
        expect(isServerUnavailable(new ApiError({ status: 429, message: 'x' }))).toBe(false);
    });

    it('is false for anything that is not an ApiError', () => {
        expect(isServerUnavailable(new Error('boom'))).toBe(false);
        expect(isServerUnavailable(undefined)).toBe(false);
    });
});
