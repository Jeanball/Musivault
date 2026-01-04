import React from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

interface NavbarProps {
  username: string;
  isAdmin: boolean;
  onLogout: () => void;
}


const Navbar: React.FC<NavbarProps> = ({ username, isAdmin, onLogout }) => {
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => location.pathname === path;
  const isCollectionActive = location.pathname.startsWith('/app/collection');

  return (
    <>
      {/* --- DESKTOP (Standard) --- */}
      <div className="navbar bg-base-100 rounded-box shadow-xl mb-8 hidden lg:flex">
        <div className="navbar-start">
          <Link to="/app" className="btn btn-ghost normal-case gap-3 hover:bg-transparent">
            <div className="avatar">
              <div className="w-10 rounded-xl shadow-md ring ring-primary ring-offset-base-100 ring-offset-1">
                <img src="/icons/icon-192x192.png" alt="Musivault Logo" />
              </div>
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">MUSIVAULT</span>
          </Link>
        </div>

        <div className="navbar-center">
          <ul className="menu menu-horizontal px-1 gap-2">
            <li>
              <Link to="/app" className={isActive('/app') ? 'active font-bold' : 'font-medium'}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {t('nav.search', 'Search')}
              </Link>
            </li>
            <li>
              <Link to="/app/collection" className={isCollectionActive ? 'active font-bold' : 'font-medium'}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                {t('nav.collection', 'Collection')}
              </Link>
            </li>
            <li>
              <Link to="/app/discover" className={isActive('/app/discover') ? 'active font-bold' : 'font-medium'}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                {t('nav.discover', 'Discover')}
              </Link>
            </li>
          </ul>
        </div>

        <div className="navbar-end gap-2">
          {/* User Dropdown */}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder border border-base-300 hover:border-primary transition-colors">
              <div className="bg-neutral text-neutral-content rounded-full w-10">
                <span className="text-lg font-bold">{username.charAt(0).toUpperCase()}</span>
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow-2xl menu menu-sm dropdown-content bg-base-200/90 backdrop-blur-md rounded-box w-52 border border-base-300">
              <li className="menu-title px-4 py-2">{t('nav.signedInAs', 'Signed in as')} <span className="text-primary truncate block">{username}</span></li>
              <div className="divider my-0"></div>
              <li><Link to="/app/settings">{t('nav.settings', 'Settings')}</Link></li>
              {isAdmin && <li><Link to="/app/admin">{t('nav.administration', 'Administration')}</Link></li>}
              <li><a onClick={onLogout} className="text-error hover:bg-error/10">{t('nav.logout', 'Logout')}</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* --- MOBILE (Bottom Nav) --- */}
      <div className="btm-nav lg:hidden z-50 bg-base-100/95 backdrop-blur-lg border-t border-base-300 pb-safe">
        <Link to="/app" className={`${isActive('/app') ? 'active text-primary bg-primary/10 border-t-2 border-primary' : 'text-base-content/60 hover:text-primary'} transition-all`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="btm-nav-label text-xs font-medium">{t('nav.search', 'Search')}</span>
        </Link>
        <Link to="/app/collection" className={`${isCollectionActive ? 'active text-primary bg-primary/10 border-t-2 border-primary' : 'text-base-content/60 hover:text-primary'} transition-all`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="btm-nav-label text-xs font-medium">{t('nav.collection', 'Collection')}</span>
        </Link>
        <Link to="/app/discover" className={`${isActive('/app/discover') ? 'active text-primary bg-primary/10 border-t-2 border-primary' : 'text-base-content/60 hover:text-primary'} transition-all`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          <span className="btm-nav-label text-xs font-medium">{t('nav.discover', 'Discover')}</span>
        </Link>
        <button className={`dropdown dropdown-top dropdown-end ${location.pathname === '/app/settings' ? 'active text-primary bg-primary/10 border-t-2 border-primary' : 'text-base-content/60 hover:text-primary'}`}>
          {/* Dropdown triggers on click for mobile usually needs careful handling, simplified for standard daisyui behavior */}
          <div tabIndex={0} role="button" className="flex flex-col items-center justify-center w-full h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="btm-nav-label text-xs font-medium">{t('nav.account', 'Account')}</span>
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-200/95 backdrop-blur-md rounded-box w-56 mb-4 border border-base-300">
            <li className="menu-title text-center">{t('nav.hi', 'Hi')}, {username}</li>
            <div className="divider my-0"></div>
            <li><Link to="/app/settings">{t('nav.settings', 'Settings')}</Link></li>
            {isAdmin && <li><Link to="/app/admin">{t('nav.administration', 'Administration')}</Link></li>}
            <li><a onClick={onLogout} className="text-error">{t('nav.logout', 'Logout')}</a></li>
          </ul>
        </button>
      </div>
    </>
  );
};

export default Navbar;
