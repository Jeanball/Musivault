import type { Request } from 'express';
import { logger } from '../config/logger.config';

/** A user as it appears in an audit entry: the account, never what was typed to reach it. */
export interface AuditUser {
    id: string;
    username: string;
}

export type AuditAction =
    | 'login'
    | 'signup'
    | 'rate_limited'
    | 'admin.forbidden'
    | 'user.create'
    | 'user.update'
    | 'user.delete'
    | 'task.run';

export interface AuditEvent {
    action: AuditAction;
    outcome: 'success' | 'failure';
    /** Who did it. Defaults to the signed-in user of the request; pass it when there is none yet (login, signup). */
    actor?: AuditUser;
    /** The account the action was about, when it is not the actor. */
    target?: AuditUser;
    /** Names of the fields an edit changed (other than the role), never their values. */
    changed?: string[];
    /** The role a user had and now has; `from` is left out for a new account. Roles are not secrets, unlike the other fields. */
    role?: { from?: 'admin' | 'user'; to: 'admin' | 'user' };
    /** Why a failure happened, as a short code such as `wrong_password` or `unknown_user`. */
    reason?: string;
    /** What else identifies the action: the task id, or the route a non-admin tried. */
    detail?: string;
}

/** The part of a user document an audit entry needs. */
export const auditUser = (user: { _id: unknown; username: string }): AuditUser => ({
    id: String(user._id),
    username: user.username,
});

/**
 * Record who did what, as one structured log line: `warn` for a failure, `info` for a success.
 * The message reads as `audit <action> <outcome> key="value" ...` so `docker logs`, grep or fail2ban
 * can pick it out, and the same fields sit under `audit` in the JSON. The client address is
 * `req.ip`: behind the bundled Nginx it is the real one because production trusts one proxy hop
 * (see `trust proxy` in server.ts); in development behind a proxy it needs `TRUST_PROXY=true`.
 *
 * Never pass passwords, tokens or what a user typed to sign in: callers give ids, usernames of
 * accounts that exist, field names and short reason codes. Values are quoted, so a username with a
 * line break cannot forge a second log line.
 */
export function audit(req: Request, event: AuditEvent): void {
    const actor = event.actor ?? (req.user ? auditUser(req.user) : undefined);
    const entry = {
        action: event.action,
        outcome: event.outcome,
        actor,
        target: event.target,
        changed: event.changed,
        role: event.role,
        reason: event.reason,
        detail: event.detail,
        ip: req.ip,
    };

    const text = [
        `audit ${entry.action} ${entry.outcome}`,
        actor && `actor=${JSON.stringify(actor.username)}`,
        entry.target && `target=${JSON.stringify(entry.target.username)}`,
        entry.changed?.length && `changed=${entry.changed.join(',')}`,
        entry.role && `role=${entry.role.from ? `${entry.role.from}->` : ''}${entry.role.to}`,
        entry.reason && `reason=${entry.reason}`,
        entry.detail && `detail=${JSON.stringify(entry.detail)}`,
        entry.ip && `ip=${entry.ip}`,
    ].filter(Boolean).join(' ');

    (event.outcome === 'failure' ? logger.warn : logger.info).call(logger, { audit: entry }, text);
}
