const items = [
  { label: 'Available', status: 'available', marker: '' },
  { label: 'Selected', status: 'selected', marker: '✓' },
  { label: 'Held / locked', status: 'locked', marker: '⌁' },
  { label: 'Booked / unavailable', status: 'booked', marker: '×' },
];

export default function SeatLegend() {
  return (
    <div className="capacity-legend" aria-label="Capacity unit status legend">
      {items.map((item) => (
        <div key={item.label}>
          <span className={`capacity-legend-swatch is-${item.status}`} aria-hidden="true">{item.marker}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
