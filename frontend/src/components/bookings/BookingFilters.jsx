const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending', value: 'PAYMENT_PENDING' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Failed', value: 'FAILED' },
];

export default function BookingFilters({ active, onChange }) {
  return (
    <div className="shipment-filters" role="group" aria-label="Filter shipments by status">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          aria-pressed={active === f.value}
          className={active === f.value ? 'is-active' : ''}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
