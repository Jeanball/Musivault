import { Request, Response } from 'express'
import User from '../models/User';
import CollectionItem from '../models/CollectionItem';
import { logger } from '../config/logger.config';
import mongoose from 'mongoose';
import { audit, auditUser } from '../services/audit.service';

const MIN_PASSWORD_LENGTH = 6;
/**
 * Something@domain.tld: a domain needs at least one dot, with text on both sides of every dot.
 * `localhost` is the one domain without a dot that is accepted, for self-hosted instances.
 */
const EMAIL_PATTERN = /^[^\s@]+@([^\s@.]+(\.[^\s@.]+)+|localhost)$/i;

/** A trimmed string, or `undefined` when the value is missing or not a string. */
function textOf(value: unknown): string | undefined {
    return typeof value === 'string' ? value.trim() : undefined;
}

/**
 * The message to reply with when a username or email is taken by another user,
 * otherwise null. Login accepts either as the identifier, so neither may be shared.
 * Emails are stored lowercase, so they are compared that way.
 */
async function findIdentityConflict(
    { username, email }: { username?: string; email?: string },
    exceptUserId?: unknown
): Promise<string | null> {
    const others = exceptUserId ? { _id: { $ne: exceptUserId } } : {};
    if (username && await User.findOne({ username, ...others })) {
        return "Username is already taken";
    }
    if (email && await User.findOne({ email: email.toLowerCase(), ...others })) {
        return "Email is already in use";
    }
    return null;
}

/** True when no administrator other than `userId` is left. */
async function isLastAdmin(userId: unknown): Promise<boolean> {
    return (await User.countDocuments({ isAdmin: true, _id: { $ne: userId } })) === 0;
}

export async function getAllUsers(req: Request, res: Response) {
    try {
        const users = await User.find().select('-password'); // Exclude password

        const usersWithStats = await Promise.all(users.map(async (user) => {
            const albumCount = await CollectionItem.countDocuments({ user: user._id });

            // Get the most recent album added
            const lastItem = await CollectionItem.findOne({ user: user._id })
                .sort({ addedAt: -1 })
                .select('addedAt');

            return {
                _id: user._id,
                username: user.username,
                email: user.email,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                lastAlbumAdded: lastItem?.addedAt || null,
                albumCount,
                isPublic: user.preferences?.isPublic || false,
                publicShareId: user.publicShareId
            };
        }));

        res.status(200).json(usersWithStats);
    } catch (error) {
        logger.error({ err: error }, "Error in getAllUsers controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * One user, without the password hash or the encrypted Discogs token. Admin only.
 */
export async function getUserById(req: Request, res: Response) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const user = await User.findById(req.params.id).select('-password -discogs.tokenEncrypted');
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json(user)
    } catch (error) {
        logger.error({ err: error }, "Error in getUserById controller");
        res.status(500).json({ message: "Internal server error" });
    }
}


/**
 * Admin edit of a user: username, email, password and role. Only the fields sent are changed.
 * Answers 400 for a blank or malformed field, a password under 6 characters, a username or
 * email another user has, or demoting the last administrator.
 */
export async function updateUser(req: Request, res: Response) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const { password, isAdmin } = req.body;
        const username = textOf(req.body.username);
        const email = textOf(req.body.email);
        const user = await User.findById(req.params.id);

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (username === '' || email === '') {
            res.status(400).json({ message: "Username and email cannot be empty" });
            return;
        }
        if (email !== undefined && !EMAIL_PATTERN.test(email)) {
            res.status(400).json({ message: "Email is not valid" });
            return;
        }
        if (password !== undefined && (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH)) {
            res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
            return;
        }
        if (isAdmin === false && user.isAdmin && await isLastAdmin(user._id)) {
            res.status(400).json({ message: "The last administrator cannot be demoted" });
            return;
        }

        const conflict = await findIdentityConflict({
            username: username !== user.username ? username : undefined,
            email: email !== undefined && email.toLowerCase() !== user.email ? email : undefined,
        }, user._id);
        if (conflict) {
            res.status(400).json({ message: conflict });
            return;
        }

        const changed = [
            username && username !== user.username && 'username',
            email && email.toLowerCase() !== user.email && 'email',
            password && 'password',
            typeof isAdmin === 'boolean' && isAdmin !== user.isAdmin && 'role',
        ].filter((field): field is string => typeof field === 'string');

        if (username) user.username = username;
        if (email) user.email = email;
        if (password) user.password = password;
        if (typeof isAdmin === 'boolean') user.isAdmin = isAdmin;

        await user.save();
        audit(req, { action: 'user.update', outcome: 'success', target: auditUser(user), changed });

        res.status(200).json({ message: "User updated successfully" });

    } catch (error) {
        logger.error({ err: error }, "Error in updateUser controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * Delete a user. Answers 400 when an administrator tries to delete their own account, which
 * also keeps the last administrator safe: only an administrator can call this, so the caller
 * is always left. The user's collection items are not removed.
 */
export async function deleteUser(req: Request, res: Response) {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (req.user && String(req.user._id) === req.params.id) {
            res.status(400).json({ message: "You cannot delete your own account" });
            return;
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        await User.findByIdAndDelete(user._id)
        audit(req, { action: 'user.delete', outcome: 'success', target: auditUser(user) });
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        logger.error({ err: error }, "Error in deleteUser controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * Admin creates a local account. `isAdmin` makes it an administrator and defaults to false.
 * Answers 400 for a missing or malformed field, a password under 6 characters, or a username
 * or email that is already taken, and 201 with the new user (never the password hash).
 */
export async function createAdminUser(req: Request, res: Response) {
    try {
        const username = textOf(req.body.username);
        const email = textOf(req.body.email);
        const { password } = req.body;

        if (!username || !email || typeof password !== 'string' || !password) {
            res.status(400).json({ message: "Username, email and password are required" });
            return;
        }
        if (!EMAIL_PATTERN.test(email)) {
            res.status(400).json({ message: "Email is not valid" });
            return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
            return;
        }

        const conflict = await findIdentityConflict({ username, email });
        if (conflict) {
            res.status(400).json({ message: conflict });
            return;
        }

        const newUser = new User({ username, email, password, isAdmin: req.body.isAdmin === true });
        await newUser.save();
        audit(req, {
            action: 'user.create',
            outcome: 'success',
            target: auditUser(newUser),
            changed: newUser.isAdmin ? ['role'] : [],
        });
        res.status(201).json({
            message: "User created successfully.",
            user: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                isAdmin: newUser.isAdmin,
                createdAt: newUser.createdAt,
            },
        });
    } catch (error) {
        logger.error({ err: error }, "Error in createAdminUser controller");
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
        logger.error({ err: error }, "Error in updatePassword controller");
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function updateProfile(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { username, email, displayName } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        // Check if username is being changed and if it's already taken
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
            if (existingUser) {
                res.status(400).json({ message: "Username is already taken" });
                return;
            }
            user.username = username;
        }

        // Check if email is being changed and if it's already taken
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: user._id } });
            if (existingUser) {
                res.status(400).json({ message: "Email is already in use" });
                return;
            }
            user.email = email.toLowerCase();
        }

        // Update display name (can be empty)
        if (displayName !== undefined) {
            user.displayName = displayName;
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                username: user.username,
                email: user.email,
                displayName: user.displayName
            }
        });

    } catch (error) {
        logger.error({ err: error }, "Error in updateProfile controller");
        res.status(500).json({ message: "Internal server error" });
    }
}
