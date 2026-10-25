/**
 * Local (email + password) signup can be turned off on self-hosted instances
 * so a public URL does not let anyone create an account. OIDC sign-in is not
 * affected: it stays governed by its own configuration.
 */
export function isSignupEnabled(): boolean {
    return process.env.SIGNUP_ENABLED !== 'false';
}
