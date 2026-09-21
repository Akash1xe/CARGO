import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);
  const handleLogout = () => {
    closeMenu();
    logout();
    navigate('/login');
  };
  const navClass = ({ isActive }) => `editorial-nav-link${isActive ? ' is-active' : ''}`;

  return (
    <header className="editorial-header">
      <nav className="editorial-shell editorial-navbar" aria-label="Primary navigation">
        <Link to="/" className="editorial-wordmark" onClick={closeMenu} aria-label="CargoFlow home">
          <span className="wordmark-chevron" aria-hidden="true" />
          <span>CargoFlow</span>
        </Link>

        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={menuOpen}
          aria-controls="primary-menu"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span /><span />
        </button>

        <div id="primary-menu" className={`editorial-menu${menuOpen ? ' is-open' : ''}`}>
          <div className="editorial-menu-links">
            <NavLink to="/search" className={navClass} onClick={closeMenu}>Search</NavLink>
            {isAuthenticated && <NavLink to="/bookings" className={navClass} onClick={closeMenu}>My Shipments</NavLink>}
            <a href={location.pathname === '/' ? '#how-it-works' : '/#how-it-works'} className="editorial-nav-link" onClick={closeMenu}>How It Works</a>
            {isAuthenticated && user?.role === 'ADMIN' && <NavLink to="/admin" className={navClass} onClick={closeMenu}>Admin</NavLink>}
          </div>

          <div className="editorial-account">
            {isAuthenticated ? (
              <><span className="account-name">{user?.firstName || 'Account'}</span><button type="button" className="editorial-signin" onClick={handleLogout}>Log out</button></>
            ) : (
              <Link to="/login" className="editorial-signin" onClick={closeMenu}>Sign in</Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
