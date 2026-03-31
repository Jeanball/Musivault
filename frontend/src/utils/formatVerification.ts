import type { TFunction } from 'i18next';
import type { FormatVerification } from '../types/collection.types';

export function getFormatVerificationMessage(
    verification: FormatVerification | null | undefined,
    t: TFunction
): string {
    if (!verification) {
        return '';
    }

    if (verification.status === 'mismatch') {
        return t('formatVerification.mismatch.message');
    }

    if (verification.status === 'unknown') {
        if (verification.reasonCode === 'discogs_format_unclassified') {
            return t('formatVerification.unknown.unclassified');
        }

        return t('formatVerification.unknown.noDiscogsAssociation');
    }

    if (verification.status === 'error') {
        return t('formatVerification.error.lookupFailed');
    }

    return '';
}

export function hasActiveFormatVerificationIssue(
    verification: FormatVerification | null | undefined
): verification is FormatVerification {
    return Boolean(verification && verification.status !== 'match' && !verification.ignoredAt);
}

export function hasIgnoredFormatVerificationIssue(
    verification: FormatVerification | null | undefined
): verification is FormatVerification {
    return Boolean(verification && verification.status !== 'match' && verification.ignoredAt);
}
