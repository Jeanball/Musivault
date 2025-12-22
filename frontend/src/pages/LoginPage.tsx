import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import Footer from "../components/Footer";
import { toastService, toastMessages } from "../utils/toast";

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
    const [inputValue, setInputValue] = useState<LoginFormState>({ identifier: "", password: "", });
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const { identifier, password } = inputValue;

    useEffect(() => {
        // Check if OIDC is enabled
        axios.get<{ enabled: boolean }>(`${API_BASE_URL}/api/auth/oidc/status`)
            .then(res => setOidcEnabled(res.data.enabled))
            .catch(() => setOidcEnabled(false));

        // Check for OIDC error in URL
        const error = searchParams.get('error');
        if (error === 'oidc_failed') {
            toastService.error('SSO login failed. Please try again or use local login.');
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
            toastService.error(error.response?.data?.message || toastMessages.auth.loginError);
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
                        <h2 className="card-title text-2xl font-bold self-center">Login</h2>
                        <div className="form-control">
                            <label className="label" htmlFor="identifier">
                                <span className="label-text">Email or Username</span>
                            </label>
                            <input
                                id="identifier"
                                type="text"
                                name="identifier"
                                value={identifier}
                                placeholder="Enter your username or email"
                                onChange={handleOnChange}
                                className="input input-bordered"
                                required
                            />
                        </div>
                        <div className="form-control">
                            <label className="label" htmlFor="password">
                                <span className="label-text">Password</span>
                            </label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={password}
                                placeholder="Enter your password"
                                onChange={handleOnChange}
                                className="input input-bordered"
                                required
                            />
                        </div>
                        <div className="form-control mt-6">
                            <button type="submit" className="btn btn-primary">Login</button>
                        </div>

                        {oidcEnabled && (
                            <>
                                <div className="divider">OR</div>
                                <button
                                    type="button"
                                    onClick={handleSSOLogin}
                                    className="btn btn-outline btn-secondary"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    Login with SSO
                                </button>
                            </>
                        )}

                        <div className="text-center mt-4">
                            <span className="text-sm">
                                You don't have an account?{" "}
                                <Link to="/signup" className="link link-primary">Sign Up</Link>
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
