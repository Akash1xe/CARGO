import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StationAutocomplete from './StationAutocomplete';
import Button from '../ui/Button';
import { searchApi } from '../../api/search.api';
import { useSearchStore } from '../../store/search.store';
import { useToast } from '../ui/Toast';

export default function SearchForm({ compact, variant = 'default' }) {
  const { from, to, date, setSearchParams, setResults, setSearching, isSearching } = useSearchStore();
  const [fromCode, setFromCode] = useState(from);
  const [toCode, setToCode] = useState(to);
  const [travelDate, setTravelDate] = useState(date);
  const navigate = useNavigate();
  const showToast = useToast();
  const dateInputId = useId();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!fromCode || !toCode) {
      showToast('Please select both origin and destination hubs', 'warning');
      return;
    }
    setSearchParams(fromCode, toCode, travelDate);
    setSearching(true);

    try {
      const res = await searchApi.search(fromCode, toCode, travelDate);
      setResults(res.data || res);
      navigate('/search');
    } catch (err) {
      showToast(err.message || 'Search failed', 'error');
      setSearching(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const editorial = variant === 'hero' || variant === 'results';
  const submitLabel = variant === 'results' ? 'Update Search' : 'Find Transport';

  return (
    <form onSubmit={handleSearch} className={`${compact ? 'space-y-3' : ''}${editorial ? ` editorial-search-form editorial-search-form-${variant}` : ''}`}>
      <div className={editorial ? `editorial-search-grid editorial-search-grid-${variant}` : compact ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3' : 'grid grid-cols-1 md:grid-cols-4 gap-4'}>
        <StationAutocomplete
          editorial={editorial}
          label="From hub"
          value={fromCode}
          onChange={(code) => setFromCode(code)}
          placeholder="e.g. Delhi"
        />
        <StationAutocomplete
          editorial={editorial}
          label="To hub"
          value={toCode}
          onChange={(code) => setToCode(code)}
          placeholder="e.g. Mumbai"
        />
        <div>
          <label htmlFor={dateInputId} className={editorial ? 'editorial-field-label' : 'block text-sm font-medium text-gray-700 mb-1'}>Departure date</label>
          <input
            id={dateInputId}
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            min={today}
            className={`input-field${editorial ? ' editorial-input' : ''}`}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" loading={isSearching} className={`w-full${editorial ? ' editorial-search-submit' : ''}`}>
            {submitLabel} <span aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
