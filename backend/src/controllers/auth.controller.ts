import { NextFunction, Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/token.utils';
import jwt, { JwtPayload } from 'jsonwebtoken';

export async function signupUser(req: Request, res: Response, next: NextFunction) {
    try {
        const { username, email, password, createdAt } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.json({ message: "User already exists" });
            return;
        }
        const newUser = new User({ username, email, password, createdAt })
        const token = generateToken(newUser.id);
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax'
        });
        await newUser.save();
        res.status(201).json({ message: "User created successfully.", success: true, newUser })
        next();
    } catch (error) {
        console.error("Error in createUser controller", error)
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function loginUser(req: Request, res: Response) {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            res.status(400).json({ message: 'All fields are required' });
            return;
        }

        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }],
        });
        if (!user || !(await user.comparePassword(password))) {
            console.log("Login failed: User not found.");
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }

        const token = generateToken(user.id.toString());

        user.lastLogin = new Date();
        await user.save();

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax',
            path: "/",
            maxAge: 15 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            isAdmin: user.isAdmin,
        });

    } catch (error) {
        console.error("Error in loginUser controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function logoutUser(req: Request, res: Response) {
    try {
        res.cookie('jwt', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax',
            expires: new Date(0)
        });
        res.status(200).json({ message: "User logged out successfully." });
    } catch (error) {
        console.error("Error in logoutUser controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function userVerification(req: Request, res: Response) {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            res.json({ status: false, message: "No token" });
            return;
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined.");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        const user = await User.findById(decoded.id).select("-password");

        if (user) {
            res.json({ status: true, user: user.username, isAdmin: user.isAdmin });
            return;
        } else {
            res.json({ status: false, message: "User not found" });
            return;
        }

    } catch (error) {
        res.json({ status: false, message: "Invalid token" });
        return;
    }
}