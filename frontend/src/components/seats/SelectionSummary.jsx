import { useNavigate } from 'react-router-dom';
import { useBookingStore } from '../../store/booking.store';
import { formatCapacityUnitNumber, formatCurrency } from '../../utils/format';
import { MAX_SEATS_PER_BOOKING } from '../../utils/constants';
import Button from '../ui/Button';

export default function SelectionSummary() {
  const selectedSeats = useBookingStore((s) => s.selectedSeats);
  const toggleSeat = useBookingStore((s) => s.toggleSeat);
  const navigate = useNavigate();
  const selectedUnits = [...selectedSeats.values()];
  const count = selectedUnits.length;
  const totalPrice = selectedUnits.reduce((sum, unit) => sum + (unit.price || 0), 0);

  const clearSelection = () => selectedUnits.forEach((unit) => toggleSeat(unit));

  return (
    <aside className="capacity-selection-summary" aria-labelledby="selection-heading">
      <h2 id="selection-heading">Your Selection</h2>
      <div className="capacity-selection-content">
        <div className="capacity-selection-title-row">
          <strong>Selected capacity units ({count})</strong>
          {count > 0 && <button type="button" onClick={clearSelection}>Clear all</button>}
        </div>

        {count > 0 ? (
          <div className="capacity-selected-units">
            {selectedUnits.map((unit) => (
              <button key={unit.seatId} type="button" onClick={() => toggleSeat(unit)} aria-label={`Remove ${formatCapacityUnitNumber(unit.seatNumber)} from selection`}>
                {formatCapacityUnitNumber(unit.seatNumber)} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="capacity-selection-empty">Choose one or more available capacity units.</p>
        )}

        <dl className="capacity-selection-facts">
          <div><dt>Total selected units</dt><dd>{count}</dd></div>
          <div><dt>Maximum units per booking</dt><dd>{MAX_SEATS_PER_BOOKING}</dd></div>
          <div className="capacity-selection-subtotal"><dt>Subtotal</dt><dd>{formatCurrency(totalPrice)}</dd></div>
        </dl>

        <Button disabled={count === 0} onClick={() => navigate('/booking')} className="capacity-continue-button">
          Continue to Booking <span aria-hidden="true">→</span>
        </Button>
      </div>
    </aside>
  );
}
