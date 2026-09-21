import { forwardRef, useId } from 'react';

const Select = forwardRef(function Select({ label, error, options = [], placeholder, className = '', id, ...props }, ref) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  return (
    <div className={className}>
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select ref={ref} id={selectId} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? errorId : props['aria-describedby']} className={`input-field ${error ? 'border-red-500' : ''}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p id={errorId} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});

export default Select;
