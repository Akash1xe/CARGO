import { formatCapacityType } from '../../utils/format';

export default function SeatFilters({ activeFilter, onChange, types = [], counts = {}, total = 0 }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`capacity-filter${!activeFilter ? ' is-active' : ''}`}
        aria-pressed={!activeFilter}
      >
        All <span>({total})</span>
      </button>
      {types.map((type) => (
        <button
          type="button"
          key={type}
          onClick={() => onChange(type)}
          className={`capacity-filter${activeFilter === type ? ' is-active' : ''}`}
          aria-pressed={activeFilter === type}
        >
          {formatCapacityType(type)} <span>({counts[type] || 0})</span>
        </button>
      ))}
    </div>
  );
}
