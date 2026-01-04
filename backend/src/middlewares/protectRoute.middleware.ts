import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User, { IUser } from '../models/User';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

const protectRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            res.status(401).json({ message: "Unauthorized, no token" });
            return;
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined.");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        if (!decoded) {
            res.status(401).json({ message: "Unauthorized, token failed" });
            return;
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        req.user = user;

        next();

    } catch (error) {
        console.error("Error in protectRoute middleware:", error);
        res.status(401).json({ message: "Unauthorized, invalid token" });
    }
};

export default protectRoute;
