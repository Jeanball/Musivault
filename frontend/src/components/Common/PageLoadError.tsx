import React from 'react';
import { CircleAlert, Clock, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BackButton from './BackButton';

interface PageLoadErrorProps {
    /** Rate limiting is temporary and gets its own wording and icon. */
    isRateLimited: boolean;
    /** Shown when the failure is not a rate limit. */
    message: string;
    onRetry: () => void;
    isRetrying?: boolean;
}

/**
 * Full-page state for a detail page whose data failed to load.
 *
 * Replaces the previous "toast then navigate away" handling: being throttled by
 * Discogs for a few seconds is not a reason to lose the page you were on, so the
 * user stays put and retries from here.
 */
const PageLoadError: React.FC<PageLoadErrorProps> = ({
    isRateLimited,
    message,
    onRetry,
    isRetrying = false
}) => {
    const { t } = useTranslation();

    return (
        <div className="p-4 md:p-8">
            <BackButton />

            <div className="max-w-md mx-auto text-center py-12">
                {isRateLimited ? (
                    <Clock className="w-12 h-12 mx-auto mb-4 text-warning" />
                ) : (
                    <CircleAlert className="w-12 h-12 mx-auto mb-4 text-error" />
                )}

                <h2 className="text-xl font-bold mb-2">
                    {isRateLimited ? t('errors.rateLimitedTitle') : t('errors.loadFailedTitle')}
                </h2>
                <p className="text-base-content/70 mb-6">
                    {isRateLimited ? t('errors.rateLimitedBody') : message}
                </p>

                <button onClick={onRetry} className="btn btn-primary gap-2" disabled={isRetrying}>
                    {isRetrying ? (
                        <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                        <RefreshCw size={16} />
                    )}
                    {t('errors.retry')}
                </button>
            </div>
        </div>
    );
};

export default PageLoadError;
