import { useEffect, useMemo, useState } from 'react';
import SearchForm from '../components/search/SearchForm';
import TrainList from '../components/search/TrainList';
import Spinner from '../components/ui/Spinner';
import { useSearchStore } from '../store/search.store';
import { formatDate } from '../utils/format';

const getDepartureTime = (vehicle) => vehicle.from?.departure || '';

export default function SearchPage() {
  const { results, isSearching, from, to, date } = useSearchStore();
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState('departure-asc');

  const vehicles = useMemo(
    () => results?.vehicles || results?.trains || [],
    [results],
  );

  const typeCounts = useMemo(() => vehicles.reduce((counts, vehicle) => {
    if (vehicle.vehicleType) counts[vehicle.vehicleType] = (counts[vehicle.vehicleType] || 0) + 1;
    return counts;
  }, {}), [vehicles]);

  const hasAvailabilityData = vehicles.some((vehicle) => {
    const value = (vehicle.trip || vehicle.schedule)?.available;
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  });
  const hasFilters = Object.keys(typeCounts).length > 0 || hasAvailabilityData;

  useEffect(() => {
    setSelectedTypes([]);
    setAvailableOnly(false);
  }, [results]);

  const visibleVehicles = useMemo(() => {
    const filtered = vehicles.filter((vehicle) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(vehicle.vehicleType)) return false;
      if (availableOnly) {
        const trip = vehicle.trip || vehicle.schedule;
        const value = trip?.available;
        if (trip?.status === 'CANCELLED' || value === null || value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const comparison = getDepartureTime(a).localeCompare(getDepartureTime(b));
      return sortOrder === 'departure-desc' ? -comparison : comparison;
    });
  }, [availableOnly, selectedTypes, sortOrder, vehicles]);

  const toggleType = (type) => {
    setSelectedTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  };

  const resetFilters = () => {
    setSelectedTypes([]);
    setAvailableOnly(false);
  };

  const origin = results?.from?.resolved || from;
  const destination = results?.to?.resolved || to;
  const selectedDate = results?.date && results.date !== 'any' ? results.date : date;
  const resultCount = results?.count ?? vehicles.length;

  return (
    <main className="search-results-page">
      <section className="editorial-shell search-results-hero">
        <div className="search-results-heading">
          <div>
            <p className="search-results-kicker">CargoFlow route search</p>
            <h1>Available Cargo Capacity.</h1>
            <p className="search-results-summary" aria-live="polite">
              {results ? (
                <>
                  Showing cargo transport options
                  {origin && destination && <> from <strong>{origin}</strong> to <strong>{destination}</strong></>}
                  {selectedDate && <> on <strong>{formatDate(selectedDate)}</strong></>}
                  <span aria-hidden="true"> · </span><strong>{resultCount}</strong> result{resultCount === 1 ? '' : 's'} found
                </>
              ) : 'Search a route to compare available cargo capacity.'}
            </p>
          </div>
          <div className="search-results-callout" aria-hidden="true">Capacity connects opportunity.<span /></div>
        </div>

        <div className="search-results-search-panel">
          <SearchForm variant="results" />
        </div>
      </section>

      <section className={`editorial-shell search-results-layout${hasFilters ? '' : ' search-results-layout-full'}`}>
        {hasFilters && (
          <aside className="cargo-filter-panel" aria-label="Filter cargo results">
            <h2>Filter Results</h2>
            {Object.keys(typeCounts).length > 0 && (
              <fieldset>
                <legend>Vehicle type</legend>
                {Object.entries(typeCounts).map(([type, count]) => {
                  const id = `vehicle-type-${type.toLowerCase().replaceAll('_', '-')}`;
                  return (
                    <label key={type} htmlFor={id}>
                      <input id={id} type="checkbox" checked={selectedTypes.includes(type)} onChange={() => toggleType(type)} />
                      <span>{type.replaceAll('_', ' ')}</span>
                      <small>{count}</small>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {hasAvailabilityData && (
              <fieldset>
                <legend>Availability</legend>
                <label htmlFor="available-capacity-only">
                  <input id="available-capacity-only" type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
                  <span>Available capacity only</span>
                </label>
              </fieldset>
            )}
            <button type="button" className="cargo-filter-reset" onClick={resetFilters}>Reset Filters</button>
          </aside>
        )}

        <div className="cargo-results-column">
          {results && vehicles.length > 0 && (
            <div className="cargo-results-toolbar">
              <label htmlFor="cargo-sort">Sort by</label>
              <select id="cargo-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="departure-asc">Departure time (earliest)</option>
                <option value="departure-desc">Departure time (latest)</option>
              </select>
              <p aria-live="polite">Showing {visibleVehicles.length} of {resultCount} results</p>
            </div>
          )}

          {isSearching ? (
            <div className="cargo-results-state" role="status" aria-live="polite">
              <Spinner size="lg" />
              <strong>Finding cargo capacity…</strong>
            </div>
          ) : results ? (
            <TrainList trains={visibleVehicles} />
          ) : (
            <div className="cargo-results-state cargo-results-initial">
              <span aria-hidden="true">→</span>
              <strong>Search a route to view available cargo capacity.</strong>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
