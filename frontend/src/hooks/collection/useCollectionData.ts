import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import type { CollectionItem } from '../../types/collection';

export const useCollectionData = () => {
    const [collection, setCollection] = useState<CollectionItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    useEffect(() => {
        const fetchCollection = async () => {
            try {
                const { data } = await axios.get<CollectionItem[]>('/api/collection', {
                    withCredentials: true,
                });
                setCollection(data);
            } catch (error) {
                console.error("Error by charging collection: ", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCollection();
    }, []);

    const handleDeleteItem = async (itemId: string) => {
        setIsDeleting(true);
        try {
            await axios.delete(`/api/collection/${itemId}`, { withCredentials: true });
            setCollection(currentCollection => currentCollection.filter(item => item._id !== itemId));
            toast.success("Album deleted of your collection!");
        } catch (error) {
            console.log(error);
            toast.error("Suppression failed.");
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        collection,
        isLoading,
        isDeleting,
        handleDeleteItem
    };
};
