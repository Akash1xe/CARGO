import { useState } from 'react';
import AdminTabs from '../components/admin/AdminTabs';
import StationManager from '../components/admin/StationManager';
import TrainManager from '../components/admin/TrainManager';
import RouteManager from '../components/admin/RouteManager';
import ScheduleManager from '../components/admin/ScheduleManager';

export default function AdminPage() {
  const [tab, setTab] = useState('Stations');
  return (
    <main className="admin-page"><div className="editorial-shell">
      <header className="admin-heading"><div><p>Operations Control</p><h1>CargoFlow Admin.</h1><span>Manage hubs, fleet capacity, transport routes, and dispatch schedules.</span></div><aside aria-label="Administrative interface notice">Authorized<br />Access.<i /></aside></header>
      <AdminTabs active={tab} onChange={setTab} />
      <div className="admin-tab-panel" role="tabpanel" id={`admin-panel-${tab.toLowerCase()}`} aria-labelledby={`admin-tab-${tab.toLowerCase()}`}>
        {tab === 'Stations' && <StationManager />}{tab === 'Trains' && <TrainManager />}{tab === 'Routes' && <RouteManager />}{tab === 'Schedules' && <ScheduleManager />}
      </div>
      <div className="admin-operations-note"><strong>Operations Note</strong><span>Keep network data accurate for reliable cargo search.</span></div>
    </div></main>
  );
}
