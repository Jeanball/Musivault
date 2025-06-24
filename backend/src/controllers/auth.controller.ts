import { NextFunction, Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/SecretToken';
import jwt, { JwtPayload } from 'jsonwebtoken';

export async function signupUser(req: Request, res: Response, next: NextFunction) { 
    try {
        const { username, email, password, createdAt } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
        res.json({ message: "User already exists" });
        return;
        }
        const newUser = new User({ username, email, password, createdAt})
        const token = generateToken(newUser.id);
        res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax'
    });
        await newUser.save();
        res.status(201).json({message: "User created successfully.", success: true, newUser})
        next();
    } catch (error) {
        console.error("Error in createUser controller", error)
        res.status(500).json({message: "Internal server error"});
    }
}

export async function loginUser(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'All fields are required' });
            return;
        }

        const user = await User.findOne({ email });
        if (!user) {
            console.log("Login failed: User not found.");
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log("Login failed: Password does not match.");
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const token = generateToken(user.id.toString());
        
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'lax',
            maxAge: 15 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            _id: user._id,
            username: user.username,
            email: user.email,
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
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'lax',
            expires: new Date(0)
        });
        res.status(200).json({ message: "User logged out successfully." });
    } catch (error) {
        console.error("Error in logoutUser controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}