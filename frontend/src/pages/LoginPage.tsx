import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import Footer from "../components/Footer";
import { toastService, toastMessages } from "../utils/toast";

// Interface pour l'état du formulaire
interface LoginFormState {
    identifier: string;
    password: string;
}

// Interface pour la réponse de l'API de connexion
interface LoginApiResponse {
    _id: string;
    username: string;
    email: string;
}
const API_BASE_URL = import.meta.env.API_URL || '';


const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState<LoginFormState>({ identifier: "", password: "", });
    const { identifier, password } = inputValue;

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
