import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

interface BackButtonProps {
    /**
     * Overrides the default history-back navigation, for pages that know where
     * they came from and need to restore state (scroll position, filters).
     */
    onClick?: () => void;
    /** Extra classes for the wrapper, e.g. to match a page's content width. */
    className?: string;
}

/**
 * The single back control for detail pages. Always rendered top-left, above the
 * page content, so the affordance stays in the same spot from one screen to the
 * next instead of moving to the bottom or into a toolbar.
 */
const BackButton: React.FC<BackButtonProps> = ({ onClick, className = '' }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className={`flex justify-start items-center mb-6 ${className}`}>
            <button
                onClick={onClick ?? (() => navigate(-1))}
                className="btn btn-ghost btn-sm gap-2"
            >
                <ArrowLeft size={16} /> {t('common.back')}
            </button>
        </div>
    );
};

export default BackButton;
