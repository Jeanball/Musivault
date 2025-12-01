import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require admin privileges.
 * Must be used after protectRoute middleware to ensure req.user is populated.
 */
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized, no user found" });
            return;
        }

        if (!req.user.isAdmin) {
            res.status(403).json({ message: "Forbidden, admin access required" });
            return;
        }

        next();
    } catch (error) {
        console.error("Error in requireAdmin middleware:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export default requireAdmin;