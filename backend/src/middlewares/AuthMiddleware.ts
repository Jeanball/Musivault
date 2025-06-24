import { Request, Response } from 'express';
import User from "../models/User";
import jwt, { JwtPayload } from 'jsonwebtoken';

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
            res.json({ status: true, user: user.username });
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