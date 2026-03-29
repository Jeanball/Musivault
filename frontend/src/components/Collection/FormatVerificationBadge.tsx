import React from 'react';
import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FormatVerification } from '../../types/collection.types';
import { getFormatVerificationMessage } from '../../utils/formatVerification';

interface FormatVerificationBadgeProps {
    verification?: FormatVerification | null;
    className?: string;
}

const FormatVerificationBadge: React.FC<FormatVerificationBadgeProps> = ({
    verification,
    className = ''
}) => {
    const { t } = useTranslation();

    if (!verification || verification.status === 'match') {
        return null;
    }

    const isMismatch = verification.status === 'mismatch';
    const tooltip = getFormatVerificationMessage(verification, t);
    const colorClass = isMismatch
        ? 'text-error'
        : verification.status === 'error'
            ? 'text-warning'
            : 'text-warning';

    return (
        <span
            className={`tooltip tooltip-left inline-flex ${className}`.trim()}
            data-tip={tooltip}
            aria-label={tooltip}
            title={tooltip}
        >
            <CircleAlert size={16} className={colorClass} aria-hidden="true" />
        </span>
    );
};

export default FormatVerificationBadge;
