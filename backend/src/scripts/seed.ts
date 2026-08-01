import User from '../models/User';

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
        console.log('Admin seed: no ADMIN_* environment variables set, skipping.');
        return;
    }

    try {
        // Check if any admin already exists
        const existingAdmin = await User.findOne({ isAdmin: true });
        if (existingAdmin) {
            console.log('Admin seed: an admin user already exists, skipping.');
            return;
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: adminEmail });
        if (existingUser) {
            // Promote existing user to admin
            existingUser.isAdmin = true;
            await existingUser.save();
            console.log(`Admin seed: promoted existing user "${adminUsername}" to admin.`);
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
        console.log(`Admin seed: created admin user "${adminUsername}" (${adminEmail})`);
        console.log('SECURITY: remove the ADMIN_* variables from .env after this first run.');

    } catch (error) {
        console.error('Admin seed: failed to create admin user:', error);
    }
}
