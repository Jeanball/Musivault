import SearchBar from "../components/SearchBar";
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import type { CollectionItem } from "../types/collection";
import type { PrivateOutletContext } from "../components/Layout/PrivateLayout";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get time-based greeting
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { username } = useOutletContext<PrivateOutletContext>();
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const { data } = await axios.get<CollectionItem[]>(
          `${API_BASE_URL}/api/collection?sort=latest`,
          { withCredentials: true }
        );

        if (Array.isArray(data)) {
          setCollection(data);
        }
      } catch (error) {
        console.error("Impossible de charger la collection", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollection();
  }, []);

  // Get latest 6 for display
  const latestAdditions = collection.slice(0, 6);

  const handleAlbumClick = (item: CollectionItem) => {
    navigate(`/app/album/${item._id}`);
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="grid grid-cols-1 gap-6">
        {/* Welcome Card */}

        <div className="card-body justify-center">
          <h2 className="text-center text-3xl font-bold">{getGreeting()}, {username || 'audiophile'}!</h2>
          <p className="text-center">Ready to spin some records?</p>
        </div>

      </div>

      {/* SEARCH SECTION */}
      <div className="bg-base-200 p-6 rounded-box shadow-md">
        <h3 className="text-xl font-bold mb-4 text-center ">Quick Search</h3>
        <SearchBar />
      </div>

      {/* RECENT ADDS GRID */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Freshly Added</h2>
          <a href="/app/collection" className="btn btn-ghost btn-sm">View All &rarr;</a>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>
        ) : latestAdditions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {latestAdditions.map(item => (
              <div
                key={item._id}
                onClick={() => handleAlbumClick(item)}
                className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
              >
                <figure className="aspect-square relative overflow-hidden">
                  <img src={item.album.cover_image || "/placeholder_album.png"} alt={item.album.title} className="object-cover w-full h-full" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="badge badge-primary">{item.format.name}</span>
                  </div>
                </figure>
                <div className="card-body p-3 gap-1">
                  <h3 className="card-title text-sm leading-tight truncate block" title={item.album.title}>{item.album.title}</h3>
                  <p className="text-xs opacity-70 truncate block">{item.album.artist}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-base-200 rounded-box border-2 border-dashed border-base-content/20">
            <p className="text-lg opacity-60">Your vault is empty.</p>
            <p className="text-sm opacity-50">Start by searching above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
