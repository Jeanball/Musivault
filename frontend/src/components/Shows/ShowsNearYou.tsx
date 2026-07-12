import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, Navigation, Ticket, ExternalLink, Calendar, Map, AlertCircle, Settings } from 'lucide-react';

interface Show {
  bandsintown_id: string;
  artist_name: string;
  title: string;
  datetime: string;
  url: string;
  venue: {
    name: string;
    city: string;
    region: string;
    country: string;
  };
  distance_km: number;
}

interface LocationState {
  lat: number | null;
  lon: number | null;
  name: string;
  isAuto: boolean;
}

const ShowsNearYou: React.FC = () => {
  const { t } = useTranslation();
  
  const [shows, setShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lon: null,
    name: '',
    isAuto: false
  });
  const [radius, setRadius] = useState<number>(200);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  // Try auto-location on initial load if no location is set
  useEffect(() => {
    const savedLocation = localStorage.getItem('musivault_shows_location');
    const savedRadius = localStorage.getItem('musivault_shows_radius');
    
    if (savedRadius) {
      setRadius(parseInt(savedRadius, 10));
    }
    
    if (savedLocation) {
      setLocation(JSON.parse(savedLocation));
    } else {
      handleAutoLocation();
    }
  }, []);

  // Fetch shows whenever location or radius changes
  useEffect(() => {
    if (location.lat !== null && location.lon !== null) {
      fetchShows(location.lat, location.lon, radius);
      localStorage.setItem('musivault_shows_location', JSON.stringify(location));
      localStorage.setItem('musivault_shows_radius', radius.toString());
    }
  }, [location.lat, location.lon, radius]);

  const fetchShows = async (lat: number, lon: number, rad: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/shows/nearby?latitude=${lat}&longitude=${lon}&radius=${rad}`);
      setShows(response.data);
    } catch (err) {
      console.error('Failed to fetch shows:', err);
      setError(t('discover.failedLoadShows', 'Failed to load nearby shows.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoLocation = () => {
    if (!navigator.geolocation) {
      setError(t('discover.locationError', 'Geolocation is not supported by your browser.'));
      return;
    }

    setIsSearchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: t('discover.usingAutoLocation', 'Current Location'),
          isAuto: true
        });
        setIsSearchingLocation(false);
        setIsSettingsOpen(false);
      },
      () => {
        setError(t('discover.locationError', 'Unable to retrieve your location. Please search manually.'));
        setIsSearchingLocation(false);
        setIsSettingsOpen(true);
      }
    );
  };

  const handleSearchLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingLocation(true);
    try {
      // Use Nominatim for basic city lookup
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      
      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        // Clean up display name (just take first two parts e.g. "Paris, Ile-de-France")
        const nameParts = result.display_name.split(',');
        const displayName = nameParts.slice(0, 2).join(',').trim();
        
        setLocation({
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
          name: displayName,
          isAuto: false
        });
        setSearchQuery('');
        setIsSettingsOpen(false);
      } else {
        setError(t('discover.locationError', 'Location not found. Try a different city name.'));
      }
    } catch (err) {
      console.error('Failed to search location:', err);
      setError(t('discover.locationError', 'Error searching for location.'));
    } finally {
      setIsSearchingLocation(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Settings Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-200 p-4 rounded-xl border border-base-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-sm text-base-content/60">{t('discover.locationSettings', 'Location Settings')}</p>
            <p className="font-semibold">
              {location.name || t('discover.noLocationSet', 'No location set')}
              {location.lat && <span className="text-sm font-normal text-base-content/60 ml-2">({radius} km)</span>}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="btn btn-sm btn-outline"
        >
          <Settings size={16} />
          {t('discover.changeLocation', 'Change Location')}
        </button>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-base-200 p-6 rounded-xl border border-base-300 animate-in fade-in slide-in-from-top-4">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Location Search */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Map size={18} /> Location
              </h3>
              
              <button 
                onClick={handleAutoLocation}
                disabled={isSearchingLocation}
                className="btn btn-outline w-full justify-start"
              >
                <Navigation size={18} />
                {isSearchingLocation && location.isAuto ? 
                  t('discover.fetchingLocation', 'Getting location...') : 
                  t('discover.usingAutoLocation', 'Use my current location')
                }
              </button>
              
              <div className="divider">OR</div>
              
              <form onSubmit={handleSearchLocation} className="flex gap-2">
                <div className="join w-full">
                  <input 
                    type="text" 
                    placeholder={t('discover.searchCity', 'Search city...')} 
                    className="input input-bordered join-item w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary join-item"
                    disabled={isSearchingLocation || !searchQuery.trim()}
                  >
                    <Search size={18} />
                  </button>
                </div>
              </form>
            </div>

            {/* Radius Slider */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Navigation size={18} /> {t('discover.distanceRadius', 'Search Radius')}
              </h3>
              <div className="px-2 pt-2 pb-6">
                <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="50"
                  value={radius} 
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="range range-primary" 
                />
                <div className="w-full flex justify-between text-xs px-2 mt-2 text-base-content/60">
                  <span>50km</span>
                  <span className="font-bold text-primary">{radius}km</span>
                  <span>1000km</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col justify-center items-center h-48 gap-4">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-base-content/60">{t('discover.loadingShows', 'Loading nearby shows...')}</p>
        </div>
      ) : location.lat === null ? (
        <div className="bg-base-200/50 rounded-xl p-12 text-center border-2 border-dashed border-base-300">
          <MapPin size={48} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">{t('discover.setLocationTitle', 'Set your location to find shows')}</h3>
          <p className="text-base-content/60 mb-6">{t('discover.setLocationDesc', 'We need your location to find concerts near you.')}</p>
          {!isSettingsOpen && (
            <button onClick={() => setIsSettingsOpen(true)} className="btn btn-primary">
              {t('discover.setLocation', 'Set Location')}
            </button>
          )}
        </div>
      ) : shows.length === 0 ? (
        <div className="bg-base-200/50 rounded-xl p-12 text-center border-2 border-dashed border-base-300">
          <Ticket size={48} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">{t('discover.noShowsFound', 'No upcoming shows found')}</h3>
          <p className="text-base-content/60 mb-6 max-w-md mx-auto">
            {t('discover.tryExpanding', 'Try expanding your search radius or changing your location.')}
          </p>
          {!isSettingsOpen && (
            <button onClick={() => setIsSettingsOpen(true)} className="btn btn-outline">
              {t('discover.expandSearch', 'Expand Search')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shows.map((show) => (
            <div key={show.bandsintown_id} className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow group">
              <div className="card-body p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="badge badge-primary badge-outline text-xs font-semibold py-3 px-3">
                    {t('discover.distanceAway', { distance: show.distance_km }).replace('{{distance}}', show.distance_km.toString())}
                  </div>
                  <div className="flex flex-col items-end text-sm font-semibold">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Calendar size={14} />
                      {new Date(show.datetime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                
                <h3 className="card-title text-xl font-bold mt-2 leading-tight">
                  {show.artist_name}
                </h3>
                
                {show.title && show.title !== show.artist_name && (
                  <p className="text-sm font-medium text-base-content/70 italic line-clamp-1 mb-2">
                    {show.title}
                  </p>
                )}
                
                <div className="mt-4 space-y-2 flex-grow">
                  <div className="flex items-start gap-2 text-sm text-base-content/80">
                    <MapPin size={16} className="mt-0.5 shrink-0 opacity-70" />
                    <span className="line-clamp-2">
                      <span className="font-medium">{show.venue.name}</span>
                      <br />
                      <span className="text-xs opacity-80">{show.venue.city}, {show.venue.country}</span>
                    </span>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6">
                  <a 
                    href={show.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary w-full"
                  >
                    <Ticket size={18} />
                    {t('discover.buyTickets', 'Tickets')}
                    <ExternalLink size={14} className="ml-1 opacity-70" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShowsNearYou;
