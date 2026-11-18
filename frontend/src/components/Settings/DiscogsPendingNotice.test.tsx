import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DiscogsPendingNotice from './DiscogsPendingNotice';
import { useDiscogsPending } from '../../context/DiscogsPendingContext';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key) })
}));
vi.mock('../../context/DiscogsPendingContext', () => ({ useDiscogsPending: vi.fn() }));

const pending = (overrides: Partial<ReturnType<typeof useDiscogsPending>> = {}) => ({
    newOnDiscogs: 3, merged: 2, count: 5, showNotice: true, dismissNotice: vi.fn(), refresh: vi.fn(), ...overrides
});

describe('DiscogsPendingNotice', () => {
    beforeEach(() => vi.clearAllMocks());

    it('says how many changes are waiting', () => {
        vi.mocked(useDiscogsPending).mockReturnValue(pending());

        render(<DiscogsPendingNotice onReview={vi.fn()} />);

        expect(screen.getByRole('status')).toHaveTextContent('"count":5');
        expect(screen.getByRole('status')).toHaveTextContent('"newOnDiscogs":3');
        expect(screen.getByRole('status')).toHaveTextContent('"merged":2');
    });

    it('is not there when there is nothing new to show', () => {
        vi.mocked(useDiscogsPending).mockReturnValue(pending({ showNotice: false }));

        render(<DiscogsPendingNotice onReview={vi.fn()} />);

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('opens the Discogs section and counts as seen when reviewed', () => {
        const ctx = pending();
        const onReview = vi.fn();
        vi.mocked(useDiscogsPending).mockReturnValue(ctx);

        render(<DiscogsPendingNotice onReview={onReview} />);
        fireEvent.click(screen.getByRole('button', { name: 'discogsPending.review' }));

        expect(ctx.dismissNotice).toHaveBeenCalledTimes(1);
        expect(onReview).toHaveBeenCalledTimes(1);
    });

    it('only dismisses, without opening anything, when closed', () => {
        const ctx = pending();
        const onReview = vi.fn();
        vi.mocked(useDiscogsPending).mockReturnValue(ctx);

        render(<DiscogsPendingNotice onReview={onReview} />);
        fireEvent.click(screen.getByRole('button', { name: 'discogsPending.dismiss' }));

        expect(ctx.dismissNotice).toHaveBeenCalledTimes(1);
        expect(onReview).not.toHaveBeenCalled();
    });
});
