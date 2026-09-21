import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBookingPolling } from '../hooks/useBookingPolling';
import { bookingApi } from '../api/booking.api';
import { useToast } from '../components/ui/Toast';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import BookingStatusPoller from '../components/booking/BookingStatusPoller';
import { formatCapacityType, formatCapacityUnitNumber, formatDate, formatDateTime, formatCurrency } from '../utils/format';

const CANCELLABLE_STATUSES = ['CONFIRMED', 'PAYMENT_PENDING', 'CAPACITY_HELD'];
const TERMINAL_FAILURE_STATUSES = ['FAILED', 'CANCELLED', 'EXPIRED'];

const vehicleAssets = {
  CLOSED: '/assets/cargoflow/vehicle-closed-truck.webp',
  CLOSED_TRUCK: '/assets/cargoflow/vehicle-closed-truck.webp',
  OPEN: '/assets/cargoflow/vehicle-open-truck.webp',
  OPEN_TRUCK: '/assets/cargoflow/vehicle-open-truck.webp',
  REEFER: '/assets/cargoflow/vehicle-reefer-truck.webp',
  REFRIGERATED: '/assets/cargoflow/vehicle-reefer-truck.webp',
  CONTAINER: '/assets/cargoflow/vehicle-container-truck.webp',
  CONTAINER_TRUCK: '/assets/cargoflow/vehicle-container-truck.webp',
};

const lifecycleSteps = ['Booking created', 'Capacity reserved', 'Payment', 'Shipment confirmed'];
const lifecycleIndex = {
  PENDING: 0,
  CAPACITY_HELD: 1,
  PAYMENT_PENDING: 2,
  CONFIRMING: 3,
  CONFIRMED: 4,
};

function DetailStatus({ booking }) {
  const status = booking.status;
  if (status === 'CONFIRMED') {
    return <section className="booking-detail-alert is-confirmed"><span aria-hidden="true">✓</span><div><h2>Booking Confirmed.</h2><p>Your cargo shipment booking is confirmed. The available booking details are shown below.</p></div></section>;
  }
  if (status === 'FAILED') {
    return <section className="booking-detail-alert is-failed"><span aria-hidden="true">!</span><div><h2>Booking Failed.</h2><p>{booking.failureReason || 'The shipment booking could not be completed.'}</p></div></section>;
  }
  if (status === 'CANCELLED') {
    return <section className="booking-detail-alert is-cancelled"><span aria-hidden="true">×</span><div><h2>Booking Cancelled.</h2><p>This shipment booking has been cancelled.</p></div></section>;
  }
  if (status === 'EXPIRED') {
    return <section className="booking-detail-alert is-expired"><span aria-hidden="true">—</span><div><h2>Booking Expired.</h2><p>This shipment booking expired before confirmation.</p></div></section>;
  }
  return <BookingStatusPoller status={status} />;
}

function BookingLifecycle({ status }) {
  const activeIndex = lifecycleIndex[status];
  const interrupted = TERMINAL_FAILURE_STATUSES.includes(status);
  return (
    <section className={`booking-detail-lifecycle${interrupted ? ' is-interrupted' : ''}`} aria-labelledby="booking-lifecycle-heading">
      <header><h2 id="booking-lifecycle-heading">Booking Status</h2><p>Booking-processing progress based on the current status.</p></header>
      <ol>
        {lifecycleSteps.map((label, index) => {
          const complete = !interrupted && (activeIndex === 4 || index < activeIndex);
          const current = !interrupted && activeIndex !== 4 && index === activeIndex;
          return <li key={label} className={complete ? 'is-complete' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}><span aria-hidden="true">{complete ? '✓' : index + 1}</span><strong>{label}</strong></li>;
        })}
      </ol>
      {interrupted && <p className="booking-detail-lifecycle-note">Processing ended with status: <strong>{status.replaceAll('_', ' ')}</strong>.</p>}
    </section>
  );
}

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const { booking, loading, error, refresh } = useBookingPolling(bookingId);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const showToast = useToast();

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await bookingApi.cancelShipment(bookingId);
      showToast('Shipment booking cancelled successfully', 'success');
      setShowCancel(false);
      refresh();
    } catch (err) {
      showToast(err.message || 'Failed to cancel shipment booking', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <main className="booking-detail-state" role="status" aria-live="polite"><Spinner size="lg" /><h1>Loading shipment booking…</h1></main>;
  }

  if (error) {
    return (
      <main className="booking-detail-state is-error">
        <h1>Unable to load shipment booking.</h1>
        <p>{error}</p>
        <Button type="button" onClick={refresh}>Retry</Button>
        <Link to="/bookings">Back to My Shipments</Link>
      </main>
    );
  }

  if (!booking) {
    return <main className="booking-detail-state is-error"><h1>Shipment booking not found.</h1><Link to="/bookings">Back to My Shipments</Link></main>;
  }

  const units = booking.capacityUnits || booking.seats || [];
  const packages = booking.packages || [];
  const reference = booking.trackingNumber || booking.bookingReference || booking.id || booking.shipmentBookingId || bookingId;
  const serviceName = booking.vehicleName || booking.trainName;
  const serviceNumber = booking.vehicleNumber || booking.trainNumber;
  const vehicleType = booking.vehicleType;
  const vehicleAsset = vehicleAssets[vehicleType?.toUpperCase()];
  const origin = booking.fromHubName || booking.fromStationName || booking.from?.name;
  const destination = booking.toHubName || booking.toStationName || booking.to?.name;
  const unitCount = booking.capacityUnitCount ?? booking.seatCount ?? units.length;
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);

  return (
    <main className="booking-detail-page">
      <div className="editorial-shell">
        <nav className="booking-detail-breadcrumb" aria-label="Breadcrumb"><Link to="/bookings">My Shipments</Link><span aria-hidden="true">/</span><span>Booking Details</span></nav>
        <div className="booking-detail-heading"><h1>Shipment Booking Details.</h1><Badge status={booking.status} className="booking-detail-badge" /></div>

        <DetailStatus booking={booking} />

        <div className="booking-detail-layout">
          <div className="booking-detail-main">
            <section className="booking-detail-route" aria-labelledby="route-transport-heading">
              <h2 id="route-transport-heading">Route &amp; Transport</h2>
              <div className="booking-detail-route-body">
                <div className="booking-detail-vehicle">
                  {vehicleAsset ? <img src={vehicleAsset} alt="" /> : <span aria-hidden="true">▰</span>}
                  <div>{serviceName && <strong>{serviceName}</strong>}{serviceNumber && <p>Vehicle #{serviceNumber}</p>}{vehicleType && <small>{vehicleType.replaceAll('_', ' ')}</small>}</div>
                </div>
                {origin && destination && <div className="booking-detail-route-line"><div><strong>{origin}</strong><small>Origin hub</small></div><span aria-hidden="true"><i /><b /><i /></span><div><strong>{destination}</strong><small>Destination hub</small></div></div>}
                <dl className="booking-detail-route-meta">
                  {booking.departureDate && <div><dt>Departure date</dt><dd>{formatDate(booking.departureDate)}</dd></div>}
                  <div><dt>Booking reference</dt><dd>{reference}</dd></div>
                  {booking.createdAt && <div><dt>Booked on</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>}
                </dl>
              </div>
            </section>

            <BookingLifecycle status={booking.status} />

            <section className="booking-detail-units" aria-labelledby="capacity-units-heading">
              <h2 id="capacity-units-heading">Capacity Units</h2>
              {units.length ? <div className="booking-detail-table-wrap"><table><thead><tr><th>Unit</th><th>Capacity type</th><th>Price</th></tr></thead><tbody>{units.map((unit, index) => <tr key={unit.capacityUnitId || unit.seatId || index}><td data-label="Unit">{formatCapacityUnitNumber(unit.unitNumber ?? unit.seatNumber)}</td><td data-label="Capacity type">{formatCapacityType(unit.unitType || unit.seatType)}</td><td data-label="Price">{formatCurrency(unit.price)}</td></tr>)}</tbody></table></div> : <p className="booking-detail-empty">No capacity-unit details were supplied.</p>}
            </section>
          </div>

          <aside className="booking-detail-side">
            <section className="booking-detail-summary" aria-labelledby="detail-summary-heading">
              <h2 id="detail-summary-heading">Booking Summary</h2>
              <div><dl>
                <div><dt>Booking ID</dt><dd>{reference}</dd></div>
                {booking.createdAt && <div><dt>Booked on</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>}
                <div><dt>Status</dt><dd>{booking.status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Selected units</dt><dd>{unitCount}</dd></div>
                {serviceName && <div><dt>Transport service</dt><dd>{serviceName}</dd></div>}
                {origin && destination && <div><dt>Route</dt><dd>{origin} → {destination}</dd></div>}
              </dl><div className="booking-detail-total"><span>Total amount</span><strong>{formatCurrency(booking.totalAmount)}</strong></div></div>
            </section>

            {packages.length > 0 && <section className="booking-detail-contacts" aria-labelledby="package-details-heading"><h2 id="package-details-heading">Packages</h2><div>{packages.map((item, index) => <article key={item.id || index}><strong>{item.description || 'Package description not provided'}</strong><dl><div><dt>Category</dt><dd>{item.category || '—'}</dd></div><div><dt>Weight</dt><dd>{item.weightKg ? `${item.weightKg} kg` : '—'}</dd></div>{item.declaredValue !== null && item.declaredValue !== undefined && <div><dt>Declared value</dt><dd>{formatCurrency(item.declaredValue)}</dd></div>}</dl></article>)}</div></section>}

            <div className="booking-detail-actions">
              <Link className="booking-detail-back" to="/bookings">Back to My Shipments <span aria-hidden="true">→</span></Link>
              {canCancel && <Button variant="danger" onClick={() => setShowCancel(true)}>Cancel Booking</Button>}
            </div>
          </aside>
        </div>
      </div>

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel Shipment Booking?" confirmText="Yes, Cancel Booking" onConfirm={handleCancel} loading={cancelling} danger className="booking-cancel-modal">
        Are you sure you want to cancel this shipment booking? This action cannot be undone.
        {booking.status === 'CONFIRMED' && ' A refund will be initiated.'}
      </Modal>
    </main>
  );
}
