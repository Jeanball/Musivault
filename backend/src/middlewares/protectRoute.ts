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
            res.status(401).json({ message: "Non autorisé, pas de token" });
            return;
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET n'est pas défini.");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        if (!decoded) {
            res.status(401).json({ message: "Non autorisé, le token a échoué" });
            return;
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            res.status(404).json({ message: "Utilisateur non trouvé" });
            return;
        }

        req.user = user;

        next(); 

    } catch (error) {
        console.error("Erreur dans le middleware protectRoute:", error);
        res.status(401).json({ message: "Non autorisé, token invalide" });
    }
};

export default protectRoute;
