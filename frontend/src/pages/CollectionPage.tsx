import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import CollectionContent from '../components/Collection/CollectionContent';
import { useCollectionData } from '../hooks/collection/useCollectionData';

const COLLECTION_SCROLL_KEY = 'musivault_collection_scroll_y';

interface CollectionPageLocationState {
    restoreCollectionScroll?: boolean;
}

const CollectionPage: React.FC = () => {
    const location = useLocation();
    const { collection, isLoading, isDeleting, handleDeleteItem } = useCollectionData();
    const hasRestoredScroll = useRef(false);

    useEffect(() => {
        const shouldRestore = (location.state as CollectionPageLocationState | null)?.restoreCollectionScroll;
        if (!shouldRestore || isLoading || hasRestoredScroll.current) {
            return;
        }

        const storedScrollY = sessionStorage.getItem(COLLECTION_SCROLL_KEY);
        if (!storedScrollY) {
            hasRestoredScroll.current = true;
            return;
        }

        const scrollY = Number.parseInt(storedScrollY, 10);
        hasRestoredScroll.current = true;
        sessionStorage.removeItem(COLLECTION_SCROLL_KEY);

        if (Number.isNaN(scrollY)) {
            return;
        }

        requestAnimationFrame(() => {
            window.scrollTo(0, scrollY);
        });
    }, [isLoading, location.state]);

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
