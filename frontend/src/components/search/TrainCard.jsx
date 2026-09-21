import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../../store/booking.store';
import { useAuthStore } from '../../store/auth.store';
import { formatDate } from '../../utils/format';
import Button from '../ui/Button';

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

const cargoCapacityTypes = new Set(['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS']);
const presentType = (value) => value ? value.replaceAll('_', ' ') : '';

export default function TrainCard({ train }) {
  const navigate = useNavigate();
  const setSelectedTrain = useBookingStore((s) => s.setSelectedTrain);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const schedule = train.trip || train.schedule;
  const scheduleId = schedule?.tripId || schedule?.scheduleId;
  const capacitySummary = train.capacitySummary || train.seatSummary || {};
  const vehicleType = train.vehicleType;
  const vehicleAsset = vehicleAssets[vehicleType?.toUpperCase()];
  const capacityEntries = Object.entries(capacitySummary)
    .filter(([type, count]) => cargoCapacityTypes.has(type) && Number(count) > 0);
  const totalCapacity = Number.isFinite(Number(capacitySummary.total)) ? Number(capacitySummary.total) : null;
  const availableCapacity = Number.isFinite(Number(schedule?.available)) ? Number(schedule.available) : null;
  const isCancelled = schedule?.status === 'CANCELLED';
  const hasNoAvailableCapacity = availableCapacity !== null && availableCapacity <= 0;
  const canOpenCapacity = Boolean(scheduleId) && !isCancelled && !hasNoAvailableCapacity;

  const handleCheckAvailability = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/seats/${scheduleId}`)}`);
      return;
    }
    setSelectedTrain(train, scheduleId);
    navigate(`/seats/${scheduleId}`);
  };

  return (
    <article className={`cargo-result-card${isCancelled ? ' is-unavailable' : ''}`}>
      <div className="cargo-result-vehicle">
        {vehicleType && <div className="cargo-result-type">{presentType(vehicleType)}</div>}
        <div className="cargo-result-image-wrap">
          {vehicleAsset ? (
            <img src={vehicleAsset} alt="" className="cargo-result-image" />
          ) : (
            <div className="cargo-result-placeholder" aria-hidden="true">▰</div>
          )}
        </div>
        {train.vehicleNumber || train.trainNumber ? (
          <p><span>Vehicle</span> #{train.vehicleNumber || train.trainNumber}</p>
        ) : null}
      </div>

      <div className="cargo-result-identity">
        <p className="cargo-result-label">Transport service</p>
        <h2>{train.vehicleName || train.trainName || 'Cargo vehicle'}</h2>
        {schedule?.departureDate && <p className="cargo-result-date">Departure {formatDate(schedule.departureDate)}</p>}
      </div>

      <div className="cargo-result-route">
        <div className="cargo-result-endpoint">
          <strong>{train.from?.name || 'Origin hub'}</strong>
          <span>{train.from?.code || '—'}</span>
          <time>{train.from?.departure || '—'}</time>
        </div>
        <div className="cargo-result-track" aria-hidden="true"><i /><span /><i /></div>
        <div className="cargo-result-endpoint cargo-result-endpoint-arrival">
          <strong>{train.to?.name || 'Destination hub'}</strong>
          <span>{train.to?.code || '—'}</span>
          <time>{train.to?.arrival || '—'}</time>
        </div>
        <div className="cargo-capacity-tags">
          {availableCapacity !== null && <strong>{availableCapacity} units available</strong>}
          {availableCapacity === null && totalCapacity !== null && <strong>{totalCapacity} capacity units</strong>}
          {capacityEntries.map(([type, count]) => <span key={type}>{presentType(type)} · {count}</span>)}
        </div>
      </div>

      <div className="cargo-result-action">
        {isCancelled && <strong className="cargo-unavailable-label">Cancelled</strong>}
        {!isCancelled && hasNoAvailableCapacity && <strong className="cargo-unavailable-label">No capacity available</strong>}
        {!schedule && <strong className="cargo-unavailable-label">No trip available</strong>}
        {canOpenCapacity && (
          <Button onClick={handleCheckAvailability} className="cargo-capacity-button">
            View Capacity
          </Button>
        )}
      </div>
    </article>
  );
}
