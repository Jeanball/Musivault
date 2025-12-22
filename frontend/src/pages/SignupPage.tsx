import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { toastService, toastMessages } from "../utils/toast";

// Interface for the form state, now with 'username'
interface SignupFormState {
    email: string;
    password: string;
    username: string;
}

// Interface for the expected API response
interface ApiResponse {
    success: boolean;
    message: string;
}

const API_BASE_URL = import.meta.env.API_URL || '';

const SignupPage: React.FC = () => {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState<SignupFormState>({ email: "", password: "", username: "" });
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const { email, password, username } = inputValue;

    useEffect(() => {
        // Check if OIDC is enabled
        axios.get<{ enabled: boolean }>(`${API_BASE_URL}/api/auth/oidc/status`)
            .then(res => setOidcEnabled(res.data.enabled))
            .catch(() => setOidcEnabled(false));
    }, []);

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
            const { data } = await axios.post<ApiResponse>(
                `${API_BASE_URL}/api/auth/signup`,
                { ...inputValue },
                { withCredentials: true }
            );

            const { success, message } = data;
            if (success) {
                toastService.success(message);
                setTimeout(() => {
                    navigate("/login");
                }, 1000);
            } else {
                toastService.error(message);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.log(error);
            toastService.error(error.response?.data?.message || toastMessages.auth.signupError);
        }

        setInputValue({
            ...inputValue,
            email: "",
            password: "",
            username: "",
        });
    };

    const handleSSOSignup = () => {
        window.location.href = `${API_BASE_URL}/api/auth/oidc/login`;
    };

    return (
        <div className="hero min-h-screen bg-base-200">
            <div className="card shrink-0 w-full max-w-md shadow-2xl bg-base-100">
                <form className="card-body" onSubmit={handleSubmit}>
                    <h2 className="card-title text-2xl font-bold self-center">Create an account</h2>
                    <div className="form-control">
                        <label className="label" htmlFor="email">
                            <span className="label-text">Email</span>
                        </label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={email}
                            placeholder="Enter your email"
                            onChange={handleOnChange}
                            className="input input-bordered"
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label" htmlFor="username">
                            <span className="label-text">Username</span>
                        </label>
                        <input
                            id="username"
                            type="text"
                            name="username"
                            value={username}
                            placeholder="Enter your username"
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
                        <button type="submit" className="btn btn-primary">Sign Up</button>
                    </div>

                    {oidcEnabled && (
                        <>
                            <div className="divider">OR</div>
                            <button
                                type="button"
                                onClick={handleSSOSignup}
                                className="btn btn-outline btn-secondary"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Sign up with SSO
                            </button>
                        </>
                    )}

                    <div className="text-center mt-4">
                        <span className="text-sm">
                            Already have an account?{" "}
                            <Link to="/login" className="link link-primary">Login</Link>
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SignupPage;
