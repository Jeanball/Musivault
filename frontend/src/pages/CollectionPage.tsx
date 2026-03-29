import React from 'react';
import CollectionContent from '../components/Collection/CollectionContent';
import { useCollectionData } from '../hooks/collection/useCollectionData';

const CollectionPage: React.FC = () => {
    const { collection, isLoading, isDeleting, handleDeleteItem } = useCollectionData();

    return (
        <div className="p-2 md:p-4">
            <CollectionContent
                collection={collection}
                isLoading={isLoading}
                readOnly={false}
                onDelete={handleDeleteItem}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default CollectionPage;
