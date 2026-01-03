import React from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { LayoutType } from '../../../types/collection';

interface CollectionHeaderProps {
    layout: LayoutType;
    onLayoutChange: (layout: LayoutType) => void;
    readOnly?: boolean;
}

const CollectionHeader: React.FC<CollectionHeaderProps> = ({ layout, onLayoutChange, readOnly }) => {
    const { t } = useTranslation();
    return (
        <div className="navbar bg-base-100 rounded-box shadow-xl mb-4">
            <div className="flex-1">
                <div className="join">
                    <button
                        className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('grid')}
                    >
                        {t('collection.grid')}
                    </button>
                    <button
                        className={`btn join-item btn-sm ${layout === 'list' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('list')}
                    >
                        {t('collection.list')}
                    </button>
                    <button
                        className={`btn join-item btn-sm ${layout === 'table' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('table')}
                    >
                        {t('collection.table')}
                    </button>
                </div>
            </div>
            <div className="flex-none gap-2">
                {readOnly ? (
                    <Link to="/" className="btn btn-outline btn-primary btn-sm">
                        {t('collection.goToMusivault')}
                    </Link>
                ) : (
                    <Link to="/app" className="btn btn-outline btn-primary btn-sm">
                        {t('collection.addAlbum')}
                    </Link>
                )}
            </div>
        </div>
    );
};

export default CollectionHeader;
