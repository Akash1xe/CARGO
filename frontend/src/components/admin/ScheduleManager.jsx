import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import { formatDate } from '../../utils/format';

export default function ScheduleManager() {
  const [trains, setTrains] = useState([]); const [schedules, setSchedules] = useState([]); const [selectedTrain, setSelectedTrain] = useState(''); const [date, setDate] = useState(''); const [creating, setCreating] = useState(false); const [loading, setLoading] = useState(false); const showToast = useToast();
  const fetchSchedules = async () => { setLoading(true); try { const res = await adminApi.getTrips(); setSchedules(res.data || []); } catch (err) { setSchedules([]); showToast(err.message, 'error'); } finally { setLoading(false); } };
  useEffect(() => { adminApi.getVehicles().then((res) => setTrains(res.data || [])).catch((err) => showToast(err.message || 'Failed to load vehicles', 'error')); fetchSchedules(); }, []);
  const handleCreate = async (event) => { event.preventDefault(); if (!selectedTrain || !date) { showToast('Select vehicle and departure date', 'warning'); return; } setCreating(true); try { await adminApi.createTrip({ vehicleId: selectedTrain, departureDate: date }); showToast('Dispatch created!', 'success'); setSelectedTrain(''); setDate(''); fetchSchedules(); } catch (err) { showToast(err.message, 'error'); } finally { setCreating(false); } };
  const handleCancel = async (id) => { try { await adminApi.cancelTrip(id); showToast('Dispatch cancelled', 'success'); fetchSchedules(); } catch (err) { showToast(err.message, 'error'); } };
  const today = new Date().toISOString().split('T')[0];
  return <div className="admin-manager-stack"><form onSubmit={handleCreate} className="admin-create-panel"><h2>Create Dispatch</h2><div className="admin-create-body admin-dispatch-form"><div><label htmlFor="dispatch-vehicle">Vehicle / Service</label><select id="dispatch-vehicle" value={selectedTrain} onChange={(event) => setSelectedTrain(event.target.value)} className="input-field" required><option value="">Select vehicle</option>{trains.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber} — {vehicle.vehicleName}</option>)}</select></div><div><label htmlFor="dispatch-date">Departure Date</label><input id="dispatch-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} min={today} className="input-field" required /></div><Button type="submit" loading={creating}>Create Dispatch</Button></div></form>
    <section className="admin-list-panel"><header><h2>Dispatches</h2></header>{loading ? <div className="admin-loading" role="status"><Spinner /><span>Loading dispatches…</span></div> : schedules.length === 0 ? <EmptyState title="No Dispatches Found." message="Create a dispatch to see it here." /> : <div className="admin-table-wrap"><table><thead><tr><th>Vehicle / Service</th><th>Departure Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{schedules.map((trip) => <tr key={trip.id}><td>{trip.vehicle?.vehicleNumber || trip.vehicleId} {trip.vehicle?.vehicleName ? `— ${trip.vehicle.vehicleName}` : ''}</td><td>{formatDate(trip.departureDate)}</td><td><Badge status={trip.status} /></td><td>{trip.status === 'ACTIVE' && <Button variant="danger" onClick={() => handleCancel(trip.id)}>Cancel Dispatch</Button>}</td></tr>)}</tbody></table></div>}</section></div>;
}
