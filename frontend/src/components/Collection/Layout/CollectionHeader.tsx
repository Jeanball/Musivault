import React from 'react';
import { Link } from 'react-router';
import type { LayoutType } from '../../../types/collection';

interface CollectionHeaderProps {
    layout: LayoutType;
    onLayoutChange: (layout: LayoutType) => void;
    readOnly?: boolean;
}

const CollectionHeader: React.FC<CollectionHeaderProps> = ({ layout, onLayoutChange, readOnly }) => {
    return (
        <div className="navbar bg-base-100 rounded-box shadow-xl mb-4">
            <div className="flex-1">
                <div className="join">
                    <button
                        className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('grid')}
                    >
                        Grid
                    </button>
                    <button
                        className={`btn join-item btn-sm ${layout === 'list' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('list')}
                    >
                        List
                    </button>
                    <button
                        className={`btn join-item btn-sm ${layout === 'table' ? 'btn-active' : ''}`}
                        onClick={() => onLayoutChange('table')}
                    >
                        Table
                    </button>
                </div>
            </div>
            <div className="flex-none gap-2">
                {readOnly ? (
                    <Link to="/" className="btn btn-outline btn-primary btn-sm">
                        Go to Musivault
                    </Link>
                ) : (
                    <Link to="/app" className="btn btn-outline btn-primary btn-sm">
                        Add an album
                    </Link>
                )}
            </div>
        </div>
    );
};

export default CollectionHeader;
