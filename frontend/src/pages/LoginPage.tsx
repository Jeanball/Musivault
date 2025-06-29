import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

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

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState<LoginFormState>({ identifier: "", password: "",});
    const { identifier, password } = inputValue;



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
            await axios.post<LoginApiResponse>(
                "http://localhost:5001/api/auth/login",
                { ...inputValue },
                { withCredentials: true }
            );

            handleSuccess("Connection Succeeded!");
            
            setTimeout(() => {
                navigate("/");
            }, 1000);


        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.log(error);
            handleError(error.response?.data?.message || "An error occurred during login.");
        }

        setInputValue({
            identifier: "",
            password: "",
        });



    };

    return (
        <div className="hero min-h-screen bg-base-200">
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
                <ToastContainer />
            </div>
        </div>
    );
};

export default LoginPage;

