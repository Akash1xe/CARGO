import { formatCapacityType, formatCapacityUnitNumber, formatCurrency } from '../../utils/format';

export default function SeatTile({ seat, isSelected, onToggle }) {
  // Segment status remains authoritative when present. Any non-AVAILABLE
  // segment state is intentionally treated as unavailable for selection.
  const effectiveStatus = seat.segmentStatus
    ? (seat.segmentStatus === 'AVAILABLE' ? 'AVAILABLE' : 'BOOKED')
    : seat.status;
  const status = isSelected ? 'SELECTED' : effectiveStatus;
  const canSelect = effectiveStatus === 'AVAILABLE';
  const unitNumber = formatCapacityUnitNumber(seat.seatNumber);
  const unitType = formatCapacityType(seat.seatType);
  const price = seat.price === null || seat.price === undefined ? null : formatCurrency(seat.price);
  const statusLabel = status === 'LOCKED' ? 'Held or locked' : status === 'BOOKED' ? 'Booked or unavailable' : status.toLowerCase();
  const accessibleName = [unitNumber, unitType, price, statusLabel].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={() => canSelect && onToggle(seat)}
      disabled={!canSelect && !isSelected}
      className={`capacity-unit is-${status.toLowerCase()}`}
      aria-label={accessibleName}
      aria-pressed={canSelect ? isSelected : undefined}
    >
      <span className="capacity-unit-number">{unitNumber}</span>
      <span className="capacity-unit-marker" aria-hidden="true">
        {status === 'SELECTED' ? '✓' : status === 'LOCKED' ? '⌁' : status === 'BOOKED' || status === 'CANCELLED' ? '×' : ''}
      </span>
      <span className="capacity-unit-type">{unitType}</span>
      {seat.maxWeightKg !== null && seat.maxWeightKg !== undefined && <span>{seat.maxWeightKg} kg max</span>}
      {price && <strong>{price}</strong>}
      <span className="sr-only">{statusLabel}</span>
    </button>
  );
}
