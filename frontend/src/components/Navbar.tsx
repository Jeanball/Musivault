import React from 'react';
import { Link } from 'react-router';

interface NavbarProps {
  username: string;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  return (
    <div className="navbar bg-base-100 rounded-box shadow-xl mb-8">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl normal-case">
          MUSIVAULT
        </Link>
      </div>
      <div className="flex-none gap-4">
        <span className="font-semibold hidden sm:inline">Welcome, {username}</span>
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full">
              {/* Utilise les initiales de l'utilisateur pour l'avatar */}
              <span className="flex items-center justify-center w-full h-full bg-neutral text-neutral-content text-xl font-bold">
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
          </label>
          <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-200 rounded-box w-52">
            <li>
              <Link to="/collection">My Collection</Link>
            </li>
            <li>
              <a onClick={onLogout}>Logout</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
