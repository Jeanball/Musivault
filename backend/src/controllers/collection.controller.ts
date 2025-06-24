import { Request, Response } from 'express';
import Album from '../models/Album';
import CollectionItem from '../models/CollectionItem';


interface AddToCollectionBody {
    discogsId: number;
    title: string;
    artist: string;
    year: string;
    thumb: string,
    cover_image: string;
    format: string;
}

export async function getMyCollection(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }
        const userId = req.user._id;

        const collection = await CollectionItem.find({ user: userId })
            .populate('album'); 

        res.status(200).json(collection);

    } catch (error) {
        console.error("Erreur lors de la récupération de la collection :", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
}


export async function addToCollection(req: Request, res: Response) {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Utilisateur non authentifié." });
            return;
        }

        const { discogsId, title, artist, year, thumb, cover_image, format } = req.body as AddToCollectionBody;
        
        const userId = req.user._id;


        let album = await Album.findOne({ discogsId: discogsId });
        
        if (!album) {
            album = new Album({ discogsId, title, artist, year, thumb, cover_image });
            await album.save();
        }

        const existingItem = await CollectionItem.findOne({
            user: userId,
            album: album._id,
            format: format
        });

        if (existingItem) {
            res.status(409).json({ message: "Vous avez déjà cet album dans ce format." });
            return;
        }
        

        const newCollectionItem = new CollectionItem({
            user: userId,
            album: album._id,
            format: format,
        });

        await newCollectionItem.save();

        res.status(201).json({ message: "Album ajouté à votre collection avec succès !", item: newCollectionItem });

    } catch (error) {
        console.error("Erreur lors de l'ajout à la collection :", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
}
