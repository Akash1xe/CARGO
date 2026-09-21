const TABS = [{ internal: 'Stations', label: 'Hubs' }, { internal: 'Trains', label: 'Vehicles' }, { internal: 'Routes', label: 'Routes' }, { internal: 'Schedules', label: 'Dispatches' }];

export default function AdminTabs({ active, onChange }) {
  const handleKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    onChange(TABS[next].internal);
    document.getElementById(`admin-tab-${TABS[next].internal.toLowerCase()}`)?.focus();
  };
  return <div className="admin-tabs" role="tablist" aria-label="Admin operations">{TABS.map((tab, index) => <button key={tab.internal} id={`admin-tab-${tab.internal.toLowerCase()}`} type="button" role="tab" aria-selected={active === tab.internal} aria-controls={`admin-panel-${tab.internal.toLowerCase()}`} tabIndex={active === tab.internal ? 0 : -1} className={active === tab.internal ? 'is-active' : ''} onClick={() => onChange(tab.internal)} onKeyDown={(event) => handleKeyDown(event, index)}>{tab.label}</button>)}</div>;
}
