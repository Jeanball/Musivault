import React from 'react';
import { Link, useLocation } from 'react-router';

interface NavbarProps {
  username: string;
  onLogout: () => void;
}


const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  const location = useLocation();

  return (
   <>
      {/* --- BIG SCREEN --- */}
      <div className="navbar bg-base-100 rounded-box shadow-xl mb-8 hidden lg:flex">
        <div className="navbar-start">
          <Link to="/app" className="btn btn-ghost text-xl normal-case">
            MUSIVAULT
          </Link>
        </div>
        <div className="navbar-center">
          <ul className="menu menu-horizontal px-1">
            <li><Link to="/app/collection">My Collection</Link></li>
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
              <li><Link to="/app/settings">Settings</Link></li>
              <li><a onClick={onLogout}>Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* --- MOBILE --- */}
      <div className="btm-nav lg:hidden z-10">
        <Link to="/app" className={location.pathname === '/app' ? 'active' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="btm-nav-label">Search</span>
        </Link>
        <Link to="/app/collection" className={location.pathname.startsWith('/app/collection') ? 'active' : ''}>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="btm-nav-label">Collection</span>
        </Link>
        <button className={`dropdown dropdown-top dropdown-end ${location.pathname === '/app/settings' ? 'active' : ''}`}>
          <div tabIndex={0} role="button" className="flex flex-col items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="btm-nav-label">Account</span>
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52 mb-2">
            <li className="p-2 font-semibold text-center">Hi, {username}</li>
            <div className="divider my-0"></div>
            <li><Link to="/app/settings">Settings</Link></li>
            <li><a onClick={onLogout}>Logout</a></li>
          </ul>
        </button>
      </div>
    </>
  );
};

export default Navbar;
