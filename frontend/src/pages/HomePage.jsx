import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchForm from '../components/search/SearchForm';
import { useAuthStore } from '../store/auth.store';
import { bookingApi } from '../api/booking.api';
import { formatCurrency, formatDate } from '../utils/format';

const vehicles = [
  { name: 'Closed Truck', capacity: '1 – 10 tons', image: 'vehicle-closed-truck.webp' },
  { name: 'Open Truck', capacity: '1 – 20 tons', image: 'vehicle-open-truck.webp' },
  { name: 'Reefer Truck', capacity: '1 – 18 tons', image: 'vehicle-reefer-truck.webp' },
  { name: 'Container Truck', capacity: '20 – 32 tons', image: 'vehicle-container-truck.webp' },
];

const benefits = [
  { title: 'Verified Operators', copy: 'Trusted. Compliant. Reliable.', tone: 'blue', icon: <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Zm0 0V12m8-5-8 5m-8-5 8 5" /> },
  { title: 'Transparent Pricing', copy: 'No hidden costs.', tone: 'coral', icon: <path d="m5 12 4 4L19 6" /> },
  { title: 'Real-time Availability', copy: 'Book with confidence.', tone: 'plain', icon: <path d="m13 2-7 12h6l-1 8 7-12h-6l1-8Z" /> },
  { title: 'Built for Business', copy: 'Move more. Grow faster.', tone: 'blue', icon: <path d="M4 20v-6h4v6m2 0V9h4v11m2 0V4h4v16" /> },
];

function LineIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square" strokeLinejoin="miter">
      {children}
    </svg>
  );
}

function RecentShipment({ shipment }) {
  const id = shipment.shipmentBookingId || shipment.id;
  return (
    <Link to={`/bookings/${id}`} className="recent-shipment-card">
      <div><span className="recent-shipment-label">Tracking number</span><strong>{shipment.trackingNumber || id}</strong></div>
      <div><span className="recent-shipment-label">Vehicle</span><strong>{shipment.vehicleName || shipment.vehicleNumber || 'Cargo vehicle'}</strong></div>
      <div><span className="recent-shipment-label">Departure</span><strong>{shipment.departureDate ? formatDate(shipment.departureDate) : 'Pending'}</strong></div>
      <div className="recent-shipment-amount">
        <span className="editorial-status">{shipment.status}</span>
        {shipment.totalAmount != null && <strong>{formatCurrency(shipment.totalAmount)}</strong>}
      </div>
    </Link>
  );
}

export default function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [recentShipments, setRecentShipments] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecentShipments([]);
      return;
    }
    bookingApi.listShipments(null, 1, 3).then((response) => {
      const data = response.data || response;
      setRecentShipments(data.shipments || data.bookings || []);
    }).catch(() => {});
  }, [isAuthenticated]);

  return (
    <div className="editorial-home">
      <section className="editorial-hero" aria-labelledby="homepage-title">
        <div className="editorial-shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Intercity cargo, made bookable</p>
            <h1 id="homepage-title">Book intercity cargo capacity with confidence.</h1>
            <p className="hero-intro">Find and book reliable cargo transport across major hubs. Real capacity. Verified operators. A simpler way to move business forward.</p>
          </div>

          <div className="hero-visual" aria-label="CargoFlow freight network illustration">
            <div className="hero-blue-panel" aria-hidden="true" />
            <div className="hero-message hero-message-coral">Capacity connects opportunity.<span /></div>
            <div className="hero-message hero-message-blue">Goods move business forward.<span /></div>
            <img src="/assets/cargoflow/cargoflow-hero-freight.webp" alt="Container freight truck ready for intercity cargo transport" width="1536" height="1024" />
          </div>

          <div className="hero-search"><SearchForm variant="hero" /></div>
        </div>
      </section>

      <section className="trust-section" aria-labelledby="trust-heading">
        <div className="editorial-shell trust-layout">
          <h2 id="trust-heading" className="sr-only">Why businesses choose CargoFlow</h2>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article className="benefit-item" key={benefit.title}>
                <div className={`benefit-icon benefit-icon-${benefit.tone}`}><LineIcon>{benefit.icon}</LineIcon></div>
                <div><h3>{benefit.title}</h3><p>{benefit.copy}</p></div>
              </article>
            ))}
          </div>
          <div className="marketing-metrics" aria-label="CargoFlow network highlights">
            <div><strong>1,000+</strong><span>Registered operators</span></div>
            <div><strong>50+</strong><span>Major cargo hubs</span></div>
            <div><strong>10K+</strong><span>Shipments booked</span></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="editorial-shell lower-modules" aria-label="Cargo capacity overview">
        <article className="editorial-module vehicle-module">
          <header className="module-bar module-bar-blue"><h2>Available cargo vehicles</h2><Link to="/search">View all vehicles <span aria-hidden="true">→</span></Link></header>
          <div className="vehicle-grid">
            {vehicles.map((vehicle) => (
              <article className="vehicle-card" key={vehicle.name}>
                <img src={`/assets/cargoflow/${vehicle.image}`} alt={`${vehicle.name} available for cargo capacity booking`} width="1000" height="667" loading="lazy" />
                <h3>{vehicle.name}</h3><p>{vehicle.capacity}</p><Link to="/search" className="capacity-link">View capacity</Link>
              </article>
            ))}
          </div>
        </article>

        <article className="editorial-module route-module">
          <header className="module-bar module-bar-coral"><h2>Sample route</h2><Link to="/search">View more routes <span aria-hidden="true">→</span></Link></header>
          <div className="route-content">
            <p className="sample-label">Marketing example — Delhi to Mumbai</p>
            <div className="route-track" aria-label="Sample route from Delhi to Mumbai">
              <div className="route-line" aria-hidden="true" />
              <div className="route-stop route-stop-major route-stop-start"><i /><strong>Delhi</strong><span>Origin hub</span></div>
              <div className="route-stop"><i /><strong>Loading</strong><span>Day 1</span></div>
              <div className="route-stop"><i /><strong>In transit</strong><span>Day 1–2</span></div>
              <div className="route-stop"><i /><strong>Arriving</strong><span>Day 2</span></div>
              <div className="route-stop route-stop-major route-stop-end"><i /><strong>Mumbai</strong><span>Destination hub</span></div>
            </div>
            <div className="route-facts">
              <div><strong>General cargo</strong><span>Dry goods, FMCG, industrial</span></div>
              <div><strong>Estimated transit time</strong><span>1–2 days</span></div>
              <div><strong>Trusted route</strong><span>High operator availability</span></div>
            </div>
          </div>
        </article>
      </section>

      {isAuthenticated && recentShipments.length > 0 && (
        <section className="editorial-shell recent-shipments" aria-labelledby="recent-shipments-heading">
          <div className="section-heading-row"><h2 id="recent-shipments-heading">Recent shipments</h2><Link to="/bookings">View all <span aria-hidden="true">→</span></Link></div>
          <div className="recent-shipment-list">
            {recentShipments.map((shipment) => <RecentShipment key={shipment.shipmentBookingId || shipment.id} shipment={shipment} />)}
          </div>
        </section>
      )}
    </div>
  );
}
