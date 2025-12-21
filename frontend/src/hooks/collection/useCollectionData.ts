import { useCollectionContext } from '../../context/CollectionContext';

export const useCollectionData = () => {
    return useCollectionContext();
};
