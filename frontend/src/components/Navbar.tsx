import React from 'react';
import { Link } from 'react-router';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  username: string;
  onLogout: () => void;
}


const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {

  const { theme, setTheme } = useTheme();

  const themes = [
    "light", "dark", "cupcake", "bumblebee", "emerald", "corporate",
    "synthwave", "retro", "cyberpunk", "valentine", "halloween", "garden",
    "forest", "aqua", "lofi", "pastel", "fantasy", "wireframe", "black",
    "luxury", "dracula", "cmyk", "autumn", "business", "acid", "lemonade"
  ];


  return (
    <div className="navbar bg-base-100 rounded-box shadow-xl mb-8">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-xl normal-case">
          MUSIVAULT
        </Link>
      </div>
      <div className="flex-none gap-4">
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
            Thème
            <svg width="12px" height="12px" className="inline-block h-2 w-2 fill-current opacity-60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path></svg>
          </div>
          <ul tabIndex={0} className="dropdown-content z-[1] p-2 shadow-2xl bg-base-300 rounded-box w-52 max-h-60 overflow-y-auto">
            {themes.map(themeOption => (
              <li key={themeOption}>
                <input
                  type="radio"
                  name="theme-dropdown"
                  className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                  aria-label={themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                  value={themeOption}
                  checked={theme === themeOption}
                  onChange={() => setTheme(themeOption)}
                />
              </li>
            ))}
          </ul>
        </div>

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
