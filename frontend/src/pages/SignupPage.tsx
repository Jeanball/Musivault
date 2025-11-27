import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

// Interface pour l'état du formulaire, maintenant avec 'username'
interface SignupFormState {
  email: string;
  password: string;
  username: string; 
}

// Interface pour la réponse attendue de l'API
interface ApiResponse {
    success: boolean;
    message: string;
}

const API_BASE_URL = import.meta.env.API_URL || '';

const SignupPage: React.FC = () => {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState<SignupFormState>({email: "", password: "", username: ""});
    const { email, password, username } = inputValue;

    
    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInputValue({
            ...inputValue,
            [name]: value,
        });
    };

    const handleError = (err: string) =>
        toast.error(err, {
            position: "bottom-left",
        });

    const handleSuccess = (msg: string) =>
        toast.success(msg, {
            position: "bottom-right",
        });

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
                handleSuccess(message);
                setTimeout(() => {
                    navigate("/login");
                }, 1000);
            } else {
                handleError(message);
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.log(error);
            handleError(error.response?.data?.message || "An error occurred during signup.");
        }
        
        setInputValue({
            ...inputValue,
            email: "",
            password: "",
            username: "",
        });
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
                            placeholder="Entrez your username"
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
                    <div className="text-center mt-4">
                        <span className="text-sm">
                            Already have an account?{" "}
                            <Link to="/login" className="link link-primary">Login</Link>
                        </span>
                    </div>
                </form>
                <ToastContainer />
            </div>
        </div>
    );
};

export default SignupPage;
