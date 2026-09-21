import { formatDate } from '../../utils/format';

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

const countValue = (value) => value ?? '—';

export default function AvailabilitySummary({ availability, train }) {
  if (!availability) return null;

  const vehicleName = train?.vehicleName || train?.trainName || availability.vehicleName || availability.trainName || 'Cargo transport';
  const vehicleNumber = train?.vehicleNumber || train?.trainNumber || availability.vehicleNumber || availability.trainNumber;
  const vehicleType = train?.vehicleType || availability.vehicleType;
  const vehicleAsset = vehicleAssets[vehicleType?.toUpperCase()];
  const from = train?.from;
  const to = train?.to;
  const total = availability.totalCapacityUnits ?? availability.totalSeats;

  return (
    <section className={`capacity-route-card${from || to ? '' : ' is-compact-route'}`} aria-labelledby="capacity-route-heading">
      <div className="capacity-route-vehicle">
        {vehicleAsset ? <img src={vehicleAsset} alt="" /> : <span className="capacity-route-placeholder" aria-hidden="true">▰</span>}
        <div>
          <h2 id="capacity-route-heading">{vehicleName}</h2>
          {vehicleNumber && <p>Vehicle #{vehicleNumber}</p>}
          {vehicleType && <strong>{vehicleType.replaceAll('_', ' ')}</strong>}
        </div>
      </div>

      {(from || to) && (
        <div className="capacity-route-journey">
          <div>
            <strong>{from?.name || 'Origin hub'}</strong>
            <span>{from?.code || '—'}</span>
            <time>{from?.departure || '—'}</time>
          </div>
          <span className="capacity-route-line" aria-hidden="true"><i /><b /><i /></span>
          <div className="capacity-route-destination">
            <strong>{to?.name || 'Destination hub'}</strong>
            <span>{to?.code || '—'}</span>
            <time>{to?.arrival || '—'}</time>
          </div>
        </div>
      )}

      <div className="capacity-departure">
        <span>Departure date</span>
        <strong>{formatDate(availability.departureDate)}</strong>
      </div>

      <dl className="capacity-counts" aria-label="Capacity availability summary">
        <div><dd>{countValue(availability.available)}</dd><dt>Available</dt></div>
        <div><dd>{countValue(availability.locked)}</dd><dt>Held</dt></div>
        <div><dd>{countValue(availability.booked)}</dd><dt>Booked</dt></div>
        <div><dd>{countValue(total)}</dd><dt>Total units</dt></div>
      </dl>
    </section>
  );
}
