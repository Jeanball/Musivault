import React from 'react';
import { Disc3, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDiscogsPending } from '../../context/DiscogsPendingContext';

interface Props {
    /** Open the Discogs section of Settings. */
    onReview: () => void;
}

/**
 * Tells the user their last Discogs check found something to act on. Dismissing, or reviewing, hides it
 * until a later check finds more; the navbar badge stays until nothing is left.
 */
const DiscogsPendingNotice: React.FC<Props> = ({ onReview }) => {
    const { t } = useTranslation();
    const { showNotice, newOnDiscogs, merged, count, dismissNotice } = useDiscogsPending();

    if (!showNotice) return null;

    return (
        <div role="status" className="alert alert-info mb-6 text-sm" data-testid="discogs-notice">
            <Disc3 size={18} />
            <span className="flex-1">
                {t('discogsPending.message', { count, newOnDiscogs, merged })}
            </span>
            <button
                className="btn btn-sm"
                onClick={() => {
                    dismissNotice();
                    onReview();
                }}
            >
                {t('discogsPending.review')}
            </button>
            <button className="btn btn-ghost btn-sm btn-square" onClick={dismissNotice} aria-label={t('discogsPending.dismiss')}>
                <X size={16} />
            </button>
        </div>
    );
};

export default DiscogsPendingNotice;
