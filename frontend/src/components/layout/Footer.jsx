import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="editorial-footer">
      <div className="editorial-shell footer-inner">
        <div><strong>CargoFlow</strong><p>Distributed intercity logistics and cargo-capacity booking.</p></div>
        <nav aria-label="Footer navigation"><Link to="/search">Search capacity</Link><Link to="/bookings">My shipments</Link></nav>
      </div>
    </footer>
  );
}
