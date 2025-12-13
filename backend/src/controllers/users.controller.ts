import { Request, Response } from 'express'
import User from '../models/User';

import CollectionItem from '../models/CollectionItem';

export async function getAllUsers(req: Request, res: Response) {
    try {
        const users = await User.find().select('-password'); // Exclude password

        const usersWithStats = await Promise.all(users.map(async (user) => {
            const albumCount = await CollectionItem.countDocuments({ user: user._id });
            return {
                _id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                albumCount,
                isPublic: user.preferences?.isPublic || false,
                publicShareId: user.publicShareId
            };
        }));

        res.status(200).json(usersWithStats);
    } catch (error) {
        console.error("Error in getAllUsers controller", error)
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function getUserById(req: Request, res: Response) {
    try {
        const user = await User.findById(req.params.id)
        res.json(user)
    } catch (error) {
        console.error("Error in getUserById controller", error)
        res.status(500).json({ message: "Internal server error" });
    }
}


export async function updateUser(req: Request, res: Response) {
    try {
        const { username, email, password, isAdmin } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (username) user.username = username;
        if (email) user.email = email;
        if (password) user.password = password;
        if (typeof isAdmin === 'boolean') user.isAdmin = isAdmin;

        await user.save();

        res.status(200).json({ message: "User updated successfully" });

    } catch (error) {
        console.error("Error in updateUser controller", error)
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function deleteUser(req: Request, res: Response) {
    try {
        await User.findByIdAndDelete(req.params.id)
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error in deleteNote controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function createAdminUser(req: Request, res: Response) {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.status(400).json({ message: "User already exists" });
        return;
    }
    const newAdmin = new User({ username, email, password, isAdmin: true });
    await newAdmin.save();
    res.status(201).json({ message: "Admin user created successfully." });
}

// ===== PREFERENCES =====

export async function getPreferences(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const user = await User.findById(req.user._id).select('preferences publicShareId');
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            ...user.preferences,
            publicShareId: user.preferences?.isPublic ? user.publicShareId : null
        });
    } catch (error) {
        console.error("Error in getPreferences controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updatePreferences(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { theme, isPublic } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Update preferences
        if (theme !== undefined) {
            user.preferences = { ...user.preferences, theme };
        }
        if (isPublic !== undefined) {
            user.preferences = { ...user.preferences, isPublic };
        }

        await user.save();

        res.status(200).json({
            message: "Preferences updated successfully",
            preferences: user.preferences,
            publicShareId: user.preferences.isPublic ? user.publicShareId : null
        });
    } catch (error) {
        console.error("Error in updatePreferences controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updatePassword(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ message: "Please provide both current and new passwords" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: "New password must be at least 6 characters long" });
            return;
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            res.status(400).json({ message: "Invalid current password" });
            return;
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });

    } catch (error) {
        console.error("Error in updatePassword controller", error);
        res.status(500).json({ message: "Internal server error" });
    }
}