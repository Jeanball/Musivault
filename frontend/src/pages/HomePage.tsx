import SearchBar from "../components/SearchBar";
import { useEffect, useState } from "react";
import type { CollectionItem } from "../types/collection";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';


const HomePage: React.FC = () => {
  const [latestAdditions, setLatestAdditions] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestAdditions = async () => {
      try {
        const { data } = await axios.get<CollectionItem[]>(
          `${API_BASE_URL}/api/collection?sort=latest&limit=3`,
          { withCredentials: true }
        );
        if (Array.isArray(data)) {
          setLatestAdditions(data);
        }
      } catch (error) {
        console.error("Impossible de charger les derniers ajouts", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatestAdditions();
  }, []);



  return (
    <div>

      <div className="text-center p-8 bg-base-200 rounded-box shadow-lg">
        <h1 className="text-4xl md:text-5xl font-bold">MUSIVAULT</h1>
        <p className="py-6">
          Use the search bar below to find and add new albums.
        </p>
        <SearchBar />
      </div>
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Last added</h2>
        {isLoading ? (
          <div className="flex justify-center"><span className="loading loading-dots loading-lg"></span></div>
        ) : latestAdditions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {latestAdditions.map(item => (
              <div key={item._id} className="card card-side bg-base-200 shadow-xl">
                <figure className="w-24 h-24 flex-shrink-0">
                  <img src={item.album.thumb || item.album.cover_image} alt={item.album.title} />
                </figure>
                <div className="card-body p-4">
                  <h3 className="card-title text-base leading-tight truncate">{item.album.title}</h3>
                  <p className="text-sm opacity-70 truncate">{item.album.artist}</p>
                  <div className="badge badge-accent mt-2">{item.format.name}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-base-200 rounded-box">
            <p>Your collection is empty. Add your first album to see it!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
