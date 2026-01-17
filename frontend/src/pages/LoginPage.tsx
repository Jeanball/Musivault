import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import Footer from "../components/Navigation/Footer";
import { toastService } from "../utils/toast";

// Interface for the form state
interface LoginFormState {
    identifier: string;
    password: string;
}

// Interface for the login API response
interface LoginApiResponse {
    _id: string;
    username: string;
    email: string;
}
const API_BASE_URL = import.meta.env.API_URL || '';


const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState<LoginFormState>({ identifier: "", password: "", });
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const [oidcProviderName, setOidcProviderName] = useState('SSO');
    const { identifier, password } = inputValue;

    useEffect(() => {
        // Check if OIDC is enabled and get provider name
        axios.get<{ enabled: boolean; providerName: string }>(`${API_BASE_URL}/api/auth/oidc/status`)
            .then(res => {
                setOidcEnabled(res.data.enabled);
                setOidcProviderName(res.data.providerName || 'SSO');
            })
            .catch(() => setOidcEnabled(false));

        // Check for OIDC error in URL
        const error = searchParams.get('error');
        if (error === 'oidc_failed') {
            toastService.error(t('auth.ssoFailed'));
        }
    }, [searchParams]);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInputValue({
            ...inputValue,
            [name]: value,
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await axios.post<LoginApiResponse>(
                `${API_BASE_URL}/api/auth/login`,
                { ...inputValue },
                { withCredentials: true }
            );
            navigate("/app", { state: { showLoginSuccess: true } });

        } catch (error: any) {
            console.log(error);
            toastService.error(error.response?.data?.message || t('auth.loginError', 'Invalid credentials'));
        }

        setInputValue({
            identifier: "",
            password: "",
        });
    };

    const handleSSOLogin = () => {
        window.location.href = `${API_BASE_URL}/api/auth/oidc/login`;
    };

    return (
        <div className="flex flex-col min-h-screen">
            <div className="flex-1 hero bg-base-200">
                <div className="card shrink-0 w-full max-w-md shadow-2xl bg-base-100">
                    <form className="card-body" onSubmit={handleSubmit}>
                        <div className="flex flex-col items-center mb-4">
                            <img src="/icons/icon-musivault.svg" alt="Musivault" className="w-16 h-16 mb-2" />
                            <h1 className="text-3xl font-bold">Musivault</h1>
                        </div>
                        <h2 className="card-title text-xl font-semibold self-center">{t('auth.login')}</h2>
                        <div className="form-control">
                            <label className="label" htmlFor="identifier">
                                <span className="label-text">{t('auth.emailOrUsername')}</span>
                            </label>
                            <input
                                id="identifier"
                                type="text"
                                name="identifier"
                                value={identifier}
                                placeholder={t('auth.enterUsernameOrEmail')}
                                onChange={handleOnChange}
                                className="input input-bordered"
                                required
                            />
                        </div>
                        <div className="form-control">
                            <label className="label" htmlFor="password">
                                <span className="label-text">{t('auth.password')}</span>
                            </label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={password}
                                placeholder={t('auth.enterPassword')}
                                onChange={handleOnChange}
                                className="input input-bordered"
                                required
                            />
                        </div>
                        <div className="form-control mt-6">
                            <button type="submit" className="btn btn-primary">{t('auth.login')}</button>
                        </div>

                        {oidcEnabled && (
                            <>
                                <div className="divider">{t('common.or')}</div>
                                <button
                                    type="button"
                                    onClick={handleSSOLogin}
                                    className="btn btn-outline btn-secondary"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    {t('auth.loginWith', { provider: oidcProviderName })}
                                </button>
                            </>
                        )}

                        <div className="text-center mt-4">
                            <span className="text-sm">
                                {t('auth.noAccount')}{" "}
                                <Link to="/signup" className="link link-primary">{t('auth.signup')}</Link>
                            </span>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default LoginPage;
