import SeatTile from './SeatTile';

export default function SeatGrid({ seats, selectedSeats, onToggleSeat }) {
  if (!seats || seats.length === 0) {
    return <p className="capacity-grid-empty">No cargo capacity is available for this route.</p>;
  }

  return (
    <div className="capacity-unit-grid">
      {seats.map((seat) => (
        <SeatTile
          key={seat.seatId || seat.id}
          seat={seat}
          isSelected={selectedSeats.has(seat.seatId)}
          onToggle={onToggleSeat}
        />
      ))}
    </div>
  );
}
