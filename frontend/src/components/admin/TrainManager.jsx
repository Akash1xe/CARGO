import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { CAPACITY_UNIT_TYPES } from '../../utils/constants';
import { formatCapacityType } from '../../utils/format';

const unitTypeOptions = CAPACITY_UNIT_TYPES.map((type) => ({ value: type, label: formatCapacityType(type) }));
const emptyVehicle = { vehicleNumber: '', vehicleName: '', vehicleType: 'CLOSED_TRUCK' };
const emptyUnit = { unitNumber: '', unitType: 'STANDARD', price: '', maxWeightKg: '' };

export default function TrainManager() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyVehicle);
  const [unitRows, setUnitRows] = useState([{ ...emptyUnit }]);
  const showToast = useToast();

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getVehicles();
      setVehicles(res.data || []);
    } catch (err) {
      setVehicles([]);
      showToast(err.message || 'Failed to load vehicles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, []);

  const addUnitRow = () => setUnitRows((rows) => [...rows, { ...emptyUnit }]);
  const removeUnitRow = (index) => setUnitRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  const updateUnitRow = (index, field, value) => setUnitRows((rows) => rows.map(
    (row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row,
  ));

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const capacityUnits = unitRows.map((row) => ({
        unitNumber: Number.parseInt(row.unitNumber, 10),
        unitType: row.unitType,
        price: Number.parseFloat(row.price),
        maxWeightKg: Number.parseFloat(row.maxWeightKg),
      }));
      await adminApi.createVehicle({ ...form, capacityUnits });
      showToast('Vehicle created!', 'success');
      setForm(emptyVehicle);
      setUnitRows([{ ...emptyUnit }]);
      fetchVehicles();
    } catch (err) {
      showToast(err.message || 'Failed to create vehicle', 'error');
    } finally {
      setCreating(false);
    }
  };

  return <div className="admin-manager-stack">
    <form onSubmit={handleCreate} className="admin-create-panel">
      <h2>Create Vehicle</h2>
      <div className="admin-create-body">
        <div className="admin-form-grid">
          <Input label="Vehicle Number" value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })} required />
          <Input label="Vehicle Name" value={form.vehicleName} onChange={(event) => setForm({ ...form, vehicleName: event.target.value })} required />
          <Input label="Vehicle Type" value={form.vehicleType} onChange={(event) => setForm({ ...form, vehicleType: event.target.value.toUpperCase() })} placeholder="e.g. CLOSED_TRUCK" required />
        </div>
        <h3>Capacity Units</h3>
        <div className="admin-dynamic-list">
          {unitRows.map((row, index) => <fieldset key={index}>
            <legend>Capacity unit {index + 1}</legend>
            <Input label="Unit #" type="number" min="1" value={row.unitNumber} onChange={(event) => updateUnitRow(index, 'unitNumber', event.target.value)} required />
            <Select label="Type" value={row.unitType} onChange={(event) => updateUnitRow(index, 'unitType', event.target.value)} options={unitTypeOptions} />
            <Input label="Price (INR)" type="number" min="0.01" step="0.01" value={row.price} onChange={(event) => updateUnitRow(index, 'price', event.target.value)} required />
            <Input label="Maximum weight (kg)" type="number" min="0.01" step="0.01" value={row.maxWeightKg} onChange={(event) => updateUnitRow(index, 'maxWeightKg', event.target.value)} required />
            {unitRows.length > 1 && <button type="button" className="admin-remove-row" aria-label={`Remove capacity unit ${index + 1}`} onClick={() => removeUnitRow(index)}>×</button>}
          </fieldset>)}
        </div>
        <div className="admin-form-actions"><Button type="button" variant="secondary" onClick={addUnitRow}>Add Capacity Unit</Button><Button type="submit" loading={creating}>Create Vehicle</Button></div>
      </div>
    </form>
    <section className="admin-list-panel">
      <header><h2>Vehicles</h2></header>
      {loading ? <div className="admin-loading" role="status"><Spinner /><span>Loading vehicles…</span></div> : vehicles.length === 0 ? <EmptyState title="No Vehicles Found." message="Create a vehicle to see it here." /> : <div className="admin-table-wrap"><table><thead><tr><th>Vehicle Number</th><th>Vehicle Name</th><th>Vehicle Type</th><th>Capacity Units</th></tr></thead><tbody>{vehicles.map((vehicle) => <tr key={vehicle.id}><td>{vehicle.vehicleNumber}</td><td>{vehicle.vehicleName}</td><td>{vehicle.vehicleType}</td><td>{vehicle.totalCapacityUnits ?? vehicle.capacityUnits?.length ?? '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
