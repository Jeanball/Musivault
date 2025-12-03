import React from 'react';
import { Link } from 'react-router';
import type { LayoutType } from '../../../types/collection';

interface CollectionHeaderProps {
    layout: LayoutType;
    onLayoutChange: (layout: LayoutType) => void;
}

const CollectionHeader: React.FC<CollectionHeaderProps> = ({ layout, onLayoutChange }) => {
    return (
        <div className="navbar bg-base-100 rounded-box shadow-xl mb-4">
            <div className="flex-1">
                <div className="join">
                    <button 
                        className={`btn join-item btn-sm ${layout === 'grid' ? 'btn-active' : ''}`} 
                        onClick={() => onLayoutChange('grid')}
                    >
                        Grille
                    </button>
                    <button 
                        className={`btn join-item btn-sm ${layout === 'list' ? 'btn-active' : ''}`} 
                        onClick={() => onLayoutChange('list')}
                    >
                        Liste
                    </button>
                    <button 
                        className={`btn join-item btn-sm ${layout === 'table' ? 'btn-active' : ''}`} 
                        onClick={() => onLayoutChange('table')}
                    >
                        Tableau
                    </button>
                </div>
            </div>
            <div className="flex-none gap-2">
                <Link to="/" className="btn btn-outline btn-primary btn-sm">
                    Add an album
                </Link>
            </div>
        </div>
    );
};

export default CollectionHeader;
