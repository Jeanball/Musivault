import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DiscogsSettings from './DiscogsSettings';
import { connectDiscogsAccount, disconnectDiscogsAccount } from '../../api/discogsAccount';
import { ApiError } from '../../api/errors';
import { toastService } from '../../utils/toast';
import type { DiscogsAccountStatus, DiscogsConnection } from '../../types/discogsAccount.types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options?.username ? `${key}:${options.username}` : key) })
}));
vi.mock('../../api/discogsAccount', () => ({
    connectDiscogsAccount: vi.fn(),
    disconnectDiscogsAccount: vi.fn()
}));
vi.mock('../../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));
// The report has its own tests; here it only has to appear or not.
vi.mock('./DiscogsCheckReport', () => ({ default: () => <div data-testid="check-report" /> }));

type Available = Extract<DiscogsAccountStatus, { available: true }>;

const connection = (overrides: Partial<DiscogsConnection> = {}): DiscogsConnection => ({
    enabled: true,
    source: 'own',
    username: 'vinylfan',
    connectedAt: '2026-10-07T09:00:00Z',
    needsReconnect: false,
    ...overrides
});

const renderSettings = (status: Partial<Available> = {}) => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    const full: Available = { available: true, canUseServerAccount: false, connection: null, ...status };
    render(<DiscogsSettings status={full} onChanged={onChanged} />);
    return onChanged;
};

describe('DiscogsSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is off by default and shows nothing to fill in', () => {
        renderSettings();

        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(screen.queryByLabelText('discogsAccount.tokenLabel')).not.toBeInTheDocument();
        expect(screen.queryByTestId('check-report')).not.toBeInTheDocument();
    });

    it('shows the token field when switched on', async () => {
        renderSettings();

        fireEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByLabelText('discogsAccount.tokenLabel')).toBeInTheDocument();
        expect(screen.queryByText('discogsAccount.useServer')).not.toBeInTheDocument();
    });

    it('offers the server account only when it is available to the user', async () => {
        renderSettings({ canUseServerAccount: true });

        fireEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByText('discogsAccount.useServer')).toBeInTheDocument();
    });

    it('connects with the server account', async () => {
        vi.mocked(connectDiscogsAccount).mockResolvedValue(undefined);
        const onChanged = renderSettings({ canUseServerAccount: true });

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByText('discogsAccount.useServer'));

        expect(connectDiscogsAccount).toHaveBeenCalledWith({ source: 'server' });
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(toastService.success).toHaveBeenCalledWith('discogsAccount.connected');
    });

    it('connects with a pasted token', async () => {
        vi.mocked(connectDiscogsAccount).mockResolvedValue(undefined);
        renderSettings();

        fireEvent.click(screen.getByRole('checkbox'));
        const connect = screen.getByRole('button', { name: 'discogsAccount.connect' });
        expect(connect).toBeDisabled();

        fireEvent.change(screen.getByLabelText('discogsAccount.tokenLabel'), { target: { value: 'my-token' } });
        fireEvent.click(connect);

        expect(connectDiscogsAccount).toHaveBeenCalledWith({ source: 'own', token: 'my-token' });
    });

    it('says when Discogs rejected the token', async () => {
        vi.mocked(connectDiscogsAccount).mockRejectedValue(
            new ApiError({ status: 400, message: 'Bad Request' })
        );
        renderSettings();

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByLabelText('discogsAccount.tokenLabel'), { target: { value: 'bogus' } });
        fireEvent.click(screen.getByRole('button', { name: 'discogsAccount.connect' }));

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsAccount.tokenRejected'));
    });

    it('says so on any other connect failure', async () => {
        vi.mocked(connectDiscogsAccount).mockRejectedValue(new ApiError({ status: 500, message: 'Server Error' }));
        renderSettings();

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByLabelText('discogsAccount.tokenLabel'), { target: { value: 'x' } });
        fireEvent.click(screen.getByRole('button', { name: 'discogsAccount.connect' }));

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('discogsAccount.connectFailed'));
    });

    it('shows who is connected and which token is used', () => {
        renderSettings({ connection: connection() });

        expect(screen.getByRole('checkbox')).toBeChecked();
        expect(screen.getByText('discogsAccount.connectedAs:vinylfan')).toBeInTheDocument();
        expect(screen.getByText('discogsAccount.sourceOwn')).toBeInTheDocument();
        expect(screen.getByTestId('check-report')).toBeInTheDocument();
    });

    it('says when the server account is in use', () => {
        renderSettings({ connection: connection({ source: 'server' }) });

        expect(screen.getByText('discogsAccount.sourceServer')).toBeInTheDocument();
    });

    it('disconnects from the toggle and from the button', async () => {
        vi.mocked(disconnectDiscogsAccount).mockResolvedValue(undefined);
        const onChanged = renderSettings({ connection: connection() });

        fireEvent.click(screen.getByRole('button', { name: 'discogsAccount.disconnect' }));

        expect(disconnectDiscogsAccount).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(onChanged).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('checkbox'));
        expect(disconnectDiscogsAccount).toHaveBeenCalledTimes(2);
    });

    it('asks for a new token and hides the check when an own token needs reconnecting', () => {
        renderSettings({ connection: connection({ needsReconnect: true }) });

        expect(screen.getByRole('alert')).toHaveTextContent('discogsAccount.needsReconnect');
        expect(screen.getByLabelText('discogsAccount.tokenLabel')).toBeInTheDocument();
        expect(screen.queryByTestId('check-report')).not.toBeInTheDocument();
    });

    it('offers a plain reconnect for the server account instead of a token field', async () => {
        vi.mocked(connectDiscogsAccount).mockResolvedValue(undefined);
        renderSettings({ connection: connection({ source: 'server', needsReconnect: true }) });

        expect(screen.queryByLabelText('discogsAccount.tokenLabel')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'discogsAccount.connect' }));

        expect(connectDiscogsAccount).toHaveBeenCalledWith({ source: 'server' });
    });
});
