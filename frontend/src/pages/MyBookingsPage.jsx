import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi } from '../api/booking.api';
import BookingCard from '../components/bookings/BookingCard';
import BookingFilters from '../components/bookings/BookingFilters';
import Pagination from '../components/ui/Pagination';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const showToast = useToast();

  const fetchBookings = async (status, page) => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await bookingApi.listShipments(status || undefined, page, 10);
      const data = res.data || res;
      setBookings(data.bookings || data.shipments || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      setBookings([]);
      setPagination({ page: 1, totalPages: 1 });
      const message = err.message || 'Failed to load shipments';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(statusFilter, 1); }, [statusFilter]);

  return (
    <main className="shipments-page"><div className="editorial-shell">
      <header className="shipments-heading"><div><h1>My Shipments.</h1><p>Review bookings, payment states, and shipment details.</p></div><Link to="/search" className="shipments-new-link">Book New Shipment <span aria-hidden="true">→</span></Link></header>
      <BookingFilters active={statusFilter} onChange={setStatusFilter} />
      <div className="shipments-results" aria-live="polite" aria-busy={loading}>
        {loading ? <div className="shipments-loading"><Spinner size="lg" /><strong>Loading shipments…</strong></div> : loadError ? (
          <EmptyState title="Unable to Load Shipments." message={loadError}><button type="button" className="shipments-empty-link" onClick={() => fetchBookings(statusFilter, pagination.page)}>Try Again →</button></EmptyState>
        ) : bookings.length === 0 ? (
          <EmptyState title="No Shipments Found." message={statusFilter ? 'No shipments match this status.' : 'Book your first cargo shipment to see it here.'}>{!statusFilter && <Link to="/search" className="shipments-empty-link">Book New Shipment →</Link>}</EmptyState>
        ) : <><div className="shipments-list">{bookings.map((booking) => <BookingCard key={booking.id || booking.shipmentBookingId} booking={booking} />)}</div><Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={(page) => fetchBookings(statusFilter, page)} /></>}
      </div>
    </div></main>
  );
}
