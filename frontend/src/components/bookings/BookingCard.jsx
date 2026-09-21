import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';
import { formatCapacityUnitNumber, formatCurrency, formatDate } from '../../utils/format';

const vehicleAssets = {
  CLOSED: '/assets/cargoflow/vehicle-closed-truck.webp', CLOSED_TRUCK: '/assets/cargoflow/vehicle-closed-truck.webp', OPEN: '/assets/cargoflow/vehicle-open-truck.webp', OPEN_TRUCK: '/assets/cargoflow/vehicle-open-truck.webp', REEFER: '/assets/cargoflow/vehicle-reefer-truck.webp', REFRIGERATED: '/assets/cargoflow/vehicle-reefer-truck.webp', CONTAINER: '/assets/cargoflow/vehicle-container-truck.webp', CONTAINER_TRUCK: '/assets/cargoflow/vehicle-container-truck.webp',
};

export default function BookingCard({ booking }) {
  const id = booking.id || booking.shipmentBookingId;
  const serviceName = booking.vehicleName || booking.trainName;
  const serviceNumber = booking.vehicleNumber || booking.trainNumber;
  const unitCount = booking.capacityUnitCount ?? booking.seatCount;
  const units = booking.capacityUnits || booking.seats || [];
  const unitLabels = units.map((unit) => formatCapacityUnitNumber(unit.unitNumber ?? unit.seatNumber));
  const origin = booking.fromHubName || booking.fromStationName || booking.from?.name;
  const destination = booking.toHubName || booking.toStationName || booking.to?.name;
  const vehicleAsset = vehicleAssets[booking.vehicleType?.toUpperCase()];
  return (
    <article className={`shipment-row status-${booking.status?.toLowerCase().replaceAll('_', '-')}`}>
      <div className="shipment-row-strip" aria-hidden="true" />
      <div className="shipment-row-service">{vehicleAsset ? <img src={vehicleAsset} alt="" /> : <span className="shipment-row-icon" aria-hidden="true">▰</span>}<div><h2>{serviceName || 'Cargo shipment'}</h2>{id && <p>Booking ID: {id}</p>}{serviceNumber && <p>Vehicle #{serviceNumber}</p>}</div></div>
      {(origin || destination || booking.departureDate || booking.createdAt) && <div className="shipment-row-route">{(origin || destination) && <div><strong>{origin || 'Origin hub'}</strong><span aria-hidden="true">→</span><strong>{destination || 'Destination hub'}</strong></div>}<p>{booking.departureDate ? `Departure ${formatDate(booking.departureDate)}` : `Booked ${formatDate(booking.createdAt)}`}</p></div>}
      <dl className="shipment-row-metrics">{unitLabels.length > 0 && <div><dt>Capacity units</dt><dd>{unitLabels.join(', ')}</dd></div>}{unitLabels.length === 0 && unitCount !== undefined && <div><dt>Capacity units</dt><dd>{unitCount}</dd></div>}{booking.totalAmount !== undefined && <div><dt>Total amount</dt><dd>{formatCurrency(booking.totalAmount)}</dd></div>}</dl>
      <div className="shipment-row-status"><Badge status={booking.status} /><Link to={`/bookings/${id}`} aria-label={`View details for ${serviceName || id || 'shipment booking'}`}>View Details <span aria-hidden="true">→</span></Link></div>
    </article>
  );
}
