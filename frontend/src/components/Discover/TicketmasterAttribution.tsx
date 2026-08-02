import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Ticketmaster's API terms require crediting them wherever their listings are
 * shown, and linking back so tickets are bought from the source.
 */
const TicketmasterAttribution: React.FC = () => {
    const { t } = useTranslation();

    return (
        <p className="text-xs text-base-content/50 mt-3">
            {t('discover.ticketmasterAttribution')}{' '}
            <a
                href="https://www.ticketmaster.com"
                target="_blank"
                rel="noopener noreferrer"
                className="link link-hover"
            >
                Ticketmaster
            </a>
        </p>
    );
};

export default TicketmasterAttribution;
