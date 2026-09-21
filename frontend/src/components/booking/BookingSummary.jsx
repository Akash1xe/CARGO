import { formatCapacityType, formatCapacityUnitNumber, formatCurrency, formatDate } from '../../utils/format';

export default function BookingSummary({ train, seats, totalPrice, departureDate, children }) {
  const serviceName = train?.vehicleName || train?.trainName;
  const from = train?.from;
  const to = train?.to;

  return (
    <aside className="booking-review" aria-labelledby="booking-summary-heading">
      <h2 id="booking-summary-heading">Booking Summary</h2>
      <div className="booking-review-body">
        <dl className="booking-review-facts">
          {serviceName && <div><dt>Transport service</dt><dd>{serviceName}</dd></div>}
          {(from?.name || to?.name) && <div><dt>Route</dt><dd>{from?.name || 'Origin hub'} → {to?.name || 'Destination hub'}</dd></div>}
          {departureDate && <div><dt>Departure date</dt><dd>{formatDate(departureDate)}</dd></div>}
          <div><dt>Selected capacity units</dt><dd>{seats.map((unit) => formatCapacityUnitNumber(unit.seatNumber)).join(', ')}</dd></div>
        </dl>

        <div className="booking-unit-table-wrap">
          <table className="booking-unit-table">
            <thead><tr><th>Unit</th><th>Capacity type</th><th>Price</th></tr></thead>
            <tbody>
              {seats.map((unit) => (
                <tr key={unit.seatId}>
                  <td>{formatCapacityUnitNumber(unit.seatNumber)}</td>
                  <td>{formatCapacityType(unit.seatType)}</td>
                  <td>{formatCurrency(unit.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="booking-review-total"><span>Subtotal</span><strong>{formatCurrency(totalPrice)}</strong></div>
        <div className="booking-security-note"><span aria-hidden="true">◇</span><p><strong>Your information is protected.</strong> Package details are used to coordinate this shipment booking.</p></div>
        {children}
      </div>
    </aside>
  );
}
