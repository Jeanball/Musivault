import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shop data is ODbL-licensed: crediting OpenStreetMap contributors wherever it
 * is displayed is a licence requirement, not a courtesy.
 */
const OsmAttribution: React.FC = () => {
    const { t } = useTranslation();

    return (
        <p className="text-xs text-base-content/50 mt-3">
            {t('discover.osmAttribution')}{' '}
            <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-hover"
            >
                © OpenStreetMap contributors
            </a>
        </p>
    );
};

export default OsmAttribution;
