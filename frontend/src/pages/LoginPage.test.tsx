import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';
import { login } from '../api/auth';
import { ApiError } from '../api/errors';
import { toastService } from '../utils/toast';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../api/auth', () => ({
    login: vi.fn(),
    getOidcStatus: vi.fn().mockResolvedValue({ enabled: false }),
    OIDC_LOGIN_URL: '/oidc'
}));
vi.mock('../utils/toast', () => ({ toastService: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/Navigation/Footer', () => ({ default: () => null }));

async function submit() {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.change(document.querySelector('input[name="identifier"]')!, { target: { value: 'me' } });
    fireEvent.change(document.querySelector('input[name="password"]')!, { target: { value: 'secret' } });
    fireEvent.submit(document.querySelector('form')!);
}

describe('LoginPage errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('shows the backend\'s message for a wrong password', async () => {
        vi.mocked(login).mockRejectedValue(new ApiError({ status: 401, message: 'x', serverMessage: 'Invalid credentials' }));

        await submit();

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Invalid credentials'));
    });

    it('says the server cannot be reached when the backend is down, not that the credentials are wrong', async () => {
        vi.mocked(login).mockRejectedValue(new ApiError({ status: 500, message: 'Request failed with status code 500' }));

        await submit();

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('auth.serverUnavailable'));
        expect(toastService.error).not.toHaveBeenCalledWith('auth.loginError');
    });

    it('says the same for a network error', async () => {
        vi.mocked(login).mockRejectedValue(new ApiError({ status: 0, message: 'Network Error', isNetworkError: true }));

        await submit();

        await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('auth.serverUnavailable'));
    });
});
