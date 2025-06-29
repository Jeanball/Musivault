import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  username: string;
  onLogout: () => void;
}


const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {

  const { setTheme } = useTheme();
  const location = useLocation();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
    "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
    "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade"
  ];

  const handleThemeChange = (theme: string) => {
    setTheme(theme);
    if (detailsRef.current) {
      detailsRef.current.removeAttribute('open');
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
   <>
      {/* --- BIG SCREEN --- */}
      <div className="navbar bg-base-100 rounded-box shadow-xl mb-8 hidden lg:flex">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost text-xl normal-case">
            MUSIVAULT
          </Link>
        </div>
        <div className="navbar-center">
          <ul className="menu menu-horizontal px-1">
            <li><Link to="/collection">My Collection</Link></li>
            <li tabIndex={0}>
              <details ref={detailsRef}>
                <summary>Theme</summary>
                <ul className="p-2 shadow bg-base-300 rounded-box w-52 max-h-60 overflow-y-auto z-[2]">
                  {themes.map(themeOption => (
                    <li key={themeOption}><a onClick={() => handleThemeChange(themeOption)}>{themeOption}</a></li>
                  ))}
                </ul>
              </details>
            </li>
          </ul>
        </div>
        <div className="navbar-end">
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
              <div className="w-10 rounded-full">
                <span className="flex items-center justify-center w-full h-full bg-neutral text-neutral-content text-xl font-bold">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-200 rounded-box w-52">
              <li className="p-2 font-semibold">Hi, {username}</li>
              <div className="divider my-0"></div>
              <li><a onClick={onLogout}>Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* --- MOBILE --- */}
      <div className="btm-nav lg:hidden z-10">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="btm-nav-label">Search</span>
        </Link>
        <Link to="/collection" className={location.pathname.startsWith('/collection') ? 'active' : ''}>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="btm-nav-label">Collection</span>
        </Link>
        <div className="dropdown dropdown-top dropdown-end">
            <label tabIndex={0} role="button" className="flex flex-col items-center justify-center h-full w-full pt-2 pb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="btm-nav-label">Settings</span>
            </label>
             <ul tabIndex={0} className="dropdown-content z-[1] mb-2 p-2 shadow bg-base-200 rounded-box w-52">
                <li className="p-2 font-semibold">Hi, {username}</li>
                <div className="divider my-0"></div>
                <li>
                  <details>
                    <summary>Theme</summary>
                     <ul className="p-2 bg-base-100 max-h-40 overflow-y-auto">
                        {themes.map(themeOption => (
                          <li key={themeOption}><a onClick={() => handleThemeChange(themeOption)}>{themeOption}</a></li>
                        ))}
                    </ul>
                  </details>
                </li>
                <li><a onClick={onLogout}>Logout</a></li>
            </ul>
        </div>
      </div>
    </>
  );
};

export default Navbar;
