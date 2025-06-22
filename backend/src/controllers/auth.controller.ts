import { Request, Response } from 'express';
import User from '../models/User';
import jwt from 'jsonwebtoken';

// Fonction pour générer un token et l'envoyer dans un cookie
const generateTokenAndSetCookie = (userId: string, res: Response) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in the environment variables.");
    }


    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
        expiresIn: '15d'
    });

    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
        maxAge: 15 * 24 * 60 * 60 * 1000 
    });
};


export async function loginUser(req: Request, res: Response) {
    try {
        console.log("1. Login attempt received for email:", req.body.email);
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            console.log("-> Login failed: User not found.");
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log("-> Login failed: Password does not match.");
            res.status(401).json({ message: "Invalid email or password." });
            return;
        }
        console.log("3. Password match successful.");

        generateTokenAndSetCookie(user.id , res);
        console.log("4. Token generated and cookie set. ", user.id, res.cookie.toString());

        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email
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
            expires: new Date(0)
        });
        res.status(200).json({ message: "User logged out successfully." });
    } catch (error) {
        console.error("Error in logoutUser controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
