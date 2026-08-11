import SearchBar from "../components/Search/SearchBar";
import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router";
import { useTranslation } from 'react-i18next';
import type { CollectionItem } from "../types/collection.types";
import type { PrivateOutletContext } from "../types/auth.types";
import { getImageUrl } from "../utils/imageUrl";
import { getCollection } from "../api/collection";
import CoverOverlay from "../components/Common/CoverOverlay";
import { MusivaultMark } from "../components/Common/BrandIcons";


/** Number of recent covers shown in the "Freshly Added" grid. */
const LATEST_COUNT = 6;

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { username, displayName } = useOutletContext<PrivateOutletContext>();
  const [latestAdditions, setLatestAdditions] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const nameToDisplay = displayName || username;

  // Helper function to get time-based greeting
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning', 'Good morning');
    if (hour < 18) return t('home.greetingAfternoon', 'Good afternoon');
    return t('home.greetingEvening', 'Good evening');
  };

  // Only the 6 covers shown below are fetched — pulling the whole collection
  // here meant downloading hundreds of items to render six.
  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const data = await getCollection('latest', LATEST_COUNT);

        if (Array.isArray(data)) {
          setLatestAdditions(data);
        }
      } catch (error) {
        console.error("Impossible de charger la collection", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollection();
  }, []);

  const handleAlbumClick = (item: CollectionItem) => {
    navigate(`/app/album/${item._id}`, {
      state: { backTo: '/app/collection' }
    });
  };

  return (
    <div className="space-y-8">
      {/* The desktop navbar is hidden below lg and the bottom dock carries no
          branding, so this is the only place the mark appears on a phone. */}
      <div className="flex items-center justify-center gap-2.5 lg:hidden">
        <MusivaultMark className="w-9 h-9 shrink-0" />
        <span className="font-brand text-3xl leading-none translate-y-[0.06em] tracking-wide bg-clip-text text-transparent bg-linear-to-r from-primary to-secondary">MUSIVAULT</span>
      </div>

      {/* HEADER */}
      <div className="grid grid-cols-1 gap-6">
        {/* Welcome Card */}

        <div className="card-body justify-center">
          <h2 className="text-center text-3xl font-bold">{getGreeting()}, {nameToDisplay || t('home.defaultUser', 'audiophile')}!</h2>
          <p className="text-center">{t('home.subtitle', 'Ready to spin some records?')}</p>
        </div>

      </div>

      {/* SEARCH SECTION */}
      <div className="bg-base-200 p-6 rounded-box shadow-panel">
        <h3 className="text-xl font-bold mb-4 text-center ">{t('home.quickSearch', 'Quick Search')}</h3>
        <SearchBar />
      </div>

      {/* RECENT ADDS GRID */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{t('home.freshlyAdded', 'Freshly Added')}</h2>
          <Link to="/app/collection" className="btn btn-ghost btn-sm">{t('home.viewAll', 'View All')} &rarr;</Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>
        ) : latestAdditions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {latestAdditions.map(item => (
              <div
                key={item._id}
                onClick={() => handleAlbumClick(item)}
                className="card bg-base-100 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <figure className="aspect-square relative overflow-hidden">
                  <img src={getImageUrl(item.album.cover_image || "/placeholder-album.svg")} alt={item.album.title} className="object-cover w-full h-full" />
                  <CoverOverlay
                    date={new Date(item.addedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}
                    dateTitle={`${t('collection.added')}: ${new Date(item.addedAt).toLocaleDateString(i18n.language)}`}
                    type={item.format.name}
                    typeTitle={item.format.name}
                  />
                </figure>
                <div className="card-body p-3 gap-1">
                  <h3 className="card-title text-sm leading-tight truncate block" title={item.album.title}>{item.album.title}</h3>
                  <p className="text-xs opacity-70 truncate block">{item.album.artist}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-base-200 rounded-box border-theme border-dashed border-base-content/20">
            <p className="text-lg opacity-60">{t('home.emptyVault', 'Your vault is empty.')}</p>
            <p className="text-sm opacity-50">{t('home.emptyVaultHint', 'Start by searching above!')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
