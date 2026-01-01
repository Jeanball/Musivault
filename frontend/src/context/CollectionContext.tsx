import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import axios from 'axios';
import { toastService, toastMessages } from '../utils/toast';
import type { CollectionItem } from '../types/collection';

interface CollectionContextType {
    collection: CollectionItem[];
    isLoading: boolean;
    isDeleting: boolean;
    refreshCollection: () => Promise<void>;
    handleDeleteItem: (itemId: string) => Promise<void>;
}

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const fetchCollection = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get<CollectionItem[]>('/api/collection', {
                withCredentials: true,
            });
            setCollection(data);
        } catch (error) {
            console.error("Error loading collection: ", error);
            // Optional: Show toast if not a 401 (auth handled by layout)
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchCollection();
    }, [fetchCollection]);

    const handleDeleteItem = async (itemId: string) => {
        setIsDeleting(true);
        try {
            await axios.delete(`/api/collection/${itemId}`, { withCredentials: true });
            setCollection(currentCollection => currentCollection.filter(item => item._id !== itemId));
            toastService.success(toastMessages.collection.deleteSuccess);
        } catch (error) {
            console.log(error);
            toastService.error(toastMessages.collection.deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <CollectionContext.Provider value={{
            collection,
            isLoading,
            isDeleting,
            refreshCollection: fetchCollection,
            handleDeleteItem
        }}>
            {children}
        </CollectionContext.Provider>
    );
};

export const useCollectionContext = () => {
    const context = useContext(CollectionContext);
    if (context === undefined) {
        throw new Error('useCollectionContext must be used within a CollectionProvider');
    }
    return context;
};
