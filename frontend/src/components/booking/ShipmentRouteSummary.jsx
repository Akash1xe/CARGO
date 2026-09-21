import { formatCapacityType, formatCapacityUnitNumber, formatDate } from '../../utils/format';

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

export default function ShipmentRouteSummary({ train, seats, departureDate }) {
  const serviceName = train?.vehicleName || train?.trainName || 'Cargo transport';
  const vehicleNumber = train?.vehicleNumber || train?.trainNumber;
  const vehicleType = train?.vehicleType;
  const asset = vehicleAssets[vehicleType?.toUpperCase()];
  const from = train?.from;
  const to = train?.to;

  return (
    <section className="booking-route-module" aria-labelledby="shipment-route-heading">
      <h2 id="shipment-route-heading">Shipment Route</h2>
      <div className="booking-route-body">
        <div className="booking-route-service">
          {asset ? <img src={asset} alt="" /> : <span aria-hidden="true">▰</span>}
          <div>
            <strong>{serviceName}</strong>
            {vehicleNumber && <small>Vehicle #{vehicleNumber}</small>}
            {vehicleType && <small>{vehicleType.replaceAll('_', ' ')}</small>}
          </div>
        </div>

        {(from || to) && (
          <div className="booking-route-path">
            <div><strong>{from?.name || 'Origin hub'}</strong><span>{from?.code || '—'}</span><time>{from?.departure || '—'}</time></div>
            <span className="booking-route-track" aria-hidden="true"><i /><b /><i /></span>
            <div className="booking-route-end"><strong>{to?.name || 'Destination hub'}</strong><span>{to?.code || '—'}</span><time>{to?.arrival || '—'}</time></div>
          </div>
        )}

        {departureDate && <div className="booking-route-date"><span>Departure date</span><strong>{formatDate(departureDate)}</strong></div>}

        <div className="booking-route-units">
          <span>Selected capacity units ({seats.length})</span>
          <div>{seats.map((unit) => <strong key={unit.seatId} title={formatCapacityType(unit.seatType)}>{formatCapacityUnitNumber(unit.seatNumber)}</strong>)}</div>
        </div>
      </div>
    </section>
  );
}
