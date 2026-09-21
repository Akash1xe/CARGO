import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import { useToast } from '../ui/Toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Pagination from '../ui/Pagination';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';

export default function StationManager() {
  const [stations, setStations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', city: '', state: '' });
  const [creating, setCreating] = useState(false);
  const showToast = useToast();
  const fetchStations = async (page = 1) => { setLoading(true); try { const res = await adminApi.getHubs(page, 20, search); setStations(res.data || []); setPagination(res.pagination || { page: 1, totalPages: 1 }); } catch (err) { setStations([]); showToast(err.message, 'error'); } finally { setLoading(false); } };
  useEffect(() => { fetchStations(); }, []);
  const handleCreate = async (event) => { event.preventDefault(); setCreating(true); try { await adminApi.createHub(form); showToast('Hub created!', 'success'); setForm({ name: '', code: '', city: '', state: '' }); fetchStations(); } catch (err) { showToast(err.message, 'error'); } finally { setCreating(false); } };
  return <div className="admin-manager-grid">
    <form onSubmit={handleCreate} className="admin-create-panel"><h2>Create Hub</h2><div className="admin-create-body"><Input label="Hub Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input label="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required maxLength={10} /><Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required /><Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} required /><Button type="submit" loading={creating}>Create Hub →</Button></div></form>
    <section className="admin-list-panel"><header><h2>Cargo Hubs</h2><form onSubmit={(event) => { event.preventDefault(); fetchStations(1); }}><label className="sr-only" htmlFor="hub-search">Search hubs</label><input id="hub-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hubs by name, code or city…" className="input-field" /><Button type="submit">Search</Button></form></header>
      {loading ? <div className="admin-loading" role="status"><Spinner /><span>Loading hubs…</span></div> : stations.length === 0 ? <EmptyState title="No Hubs Found." message="No hub records match this view." /> : <div className="admin-table-wrap"><table><thead><tr><th>Hub Name</th><th>Code</th><th>City</th><th>State</th></tr></thead><tbody>{stations.map((station) => <tr key={station.id}><td>{station.name}</td><td>{station.code}</td><td>{station.city}</td><td>{station.state}</td></tr>)}</tbody></table></div>}
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchStations} />
    </section>
  </div>;
}
