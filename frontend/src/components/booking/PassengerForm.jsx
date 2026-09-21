import Input from '../ui/Input';
import { formatCapacityType, formatCapacityUnitNumber } from '../../utils/format';

export default function PassengerForm({ index, seat, register, errors }) {
  const packageErrors = errors?.packages?.[index];
  return (
    <fieldset className="authorized-contact-card">
      <legend className="sr-only">Package for {formatCapacityUnitNumber(seat.seatNumber)}</legend>
      <div className="authorized-contact-unit">
        <span>Capacity Unit</span>
        <strong>{formatCapacityUnitNumber(seat.seatNumber)}</strong>
        <small>{formatCapacityType(seat.seatType)}</small>
      </div>
      <div className="authorized-contact-fields">
        <Input
          label="Package description (required)"
          placeholder="e.g. Industrial machine parts"
          {...register(`packages.${index}.description`, { required: 'Description is required' })}
          error={packageErrors?.description?.message}
        />
        <Input
          label="Category (required)"
          placeholder="e.g. Industrial"
          {...register(`packages.${index}.category`, { required: 'Category is required' })}
          error={packageErrors?.category?.message}
        />
        <Input
          label="Weight in kg (required)"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          {...register(`packages.${index}.weightKg`, {
            required: 'Weight is required',
            min: { value: 0.01, message: 'Weight must be greater than zero' },
            valueAsNumber: true,
          })}
          error={packageErrors?.weightKg?.message}
        />
        <Input
          label="Declared value (INR)"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          {...register(`packages.${index}.declaredValue`, {
            min: { value: 0, message: 'Declared value cannot be negative' },
            setValueAs: (value) => value === '' ? undefined : Number(value),
          })}
          error={packageErrors?.declaredValue?.message}
        />
        <Input
          label="Special instructions"
          placeholder="Optional handling instructions"
          {...register(`packages.${index}.specialInstructions`)}
          error={packageErrors?.specialInstructions?.message}
        />
      </div>
    </fieldset>
  );
}
