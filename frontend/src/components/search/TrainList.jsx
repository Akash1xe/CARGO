import TrainCard from './TrainCard';

export default function TrainList({ trains, hasCompletedSearch = true }) {
  if (!trains || trains.length === 0) {
    return (
      <div className="cargo-results-state cargo-results-empty">
        <span aria-hidden="true">×</span>
        <strong>{hasCompletedSearch ? 'No cargo capacity found' : 'Search a route'}</strong>
        <p>{hasCompletedSearch ? 'Try different hubs or another departure date.' : 'Search a route to view available cargo capacity.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trains.map((train, i) => (
        <TrainCard key={train.vehicleId || train.trainId || train.trip?.tripId || train.schedule?.scheduleId || i} train={train} />
      ))}
    </div>
  );
}
