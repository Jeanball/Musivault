import User from '../models/User';
import { logger } from '../config/logger.config';

/**
 * Seeds an initial admin user if:
 * 1. No admin users exist in the database
 * 2. ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD environment variables are set
 * 
 * This allows bootstrapping the first admin without manual database intervention.
 * After the admin is created, these environment variables can be removed.
 */
export async function seedAdminUser(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Check if admin credentials are provided
    if (!adminEmail || !adminUsername || !adminPassword) {
        logger.info('Admin seed: no ADMIN_* environment variables set, skipping.');
        return;
    }

    try {
        // Check if any admin already exists
        const existingAdmin = await User.findOne({ isAdmin: true });
        if (existingAdmin) {
            logger.info('Admin seed: an admin user already exists, skipping.');
            return;
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
            // Promote existing user to admin
            existingUser.isAdmin = true;
            await existingUser.save();
            logger.info(`Admin seed: promoted existing user "${adminUsername}" to admin.`);
            return;
        }

        // Create new admin user
        const adminUser = new User({
            username: adminUsername,
            email: adminEmail,
            password: adminPassword,
            isAdmin: true
        });

        await adminUser.save();
        logger.info(`Admin seed: created admin user "${adminUsername}" (${adminEmail})`);
        logger.info('SECURITY: remove the ADMIN_* variables from .env after this first run.');

    } catch (error) {
        logger.error({ err: error }, 'Admin seed: failed to create admin user');
    }
}
