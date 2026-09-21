import { useState, useEffect, useId, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { searchApi } from '../../api/search.api';

export default function StationAutocomplete({ label, value, onChange, placeholder, editorial = false }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef(null);
  const inputId = useId();
  const listboxId = `${inputId}-options`;

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchApi.autocomplete(debouncedQuery).then((res) => {
      if (!cancelled) {
        setSuggestions(res.data || []);
        setOpen(true);
        setActiveIndex(-1);
      }
    }).catch(() => {
      if (!cancelled) setSuggestions([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== query) setQuery(value);
  }, [value]);

  const handleSelect = (hub) => {
    setQuery(`${hub.name} (${hub.code})`);
    onChange(hub.code, hub.name);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => {
        if (event.key === 'ArrowDown') return current >= suggestions.length - 1 ? 0 : current + 1;
        return current <= 0 ? suggestions.length - 1 : current - 1;
      });
    }
    if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {label && <label htmlFor={inputId} className={editorial ? 'editorial-field-label' : 'block text-sm font-medium text-gray-700 mb-1'}>{label}</label>}
      <input
        id={inputId}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.length < 2) onChange('', '');
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`input-field${editorial ? ' editorial-input' : ''}`}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open && suggestions.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
      />
      {loading && (
        <div className="absolute right-3 top-[38px]">
          <div className="animate-spin h-4 w-4 border-b-2 border-primary-900 rounded-full" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul id={listboxId} role="listbox" className={`${editorial ? 'editorial-suggestions ' : 'border border-gray-200 rounded-lg shadow-lg '}absolute z-30 w-full mt-1 bg-white max-h-60 overflow-y-auto`}>
          {suggestions.map((s, index) => (
            <li
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              key={s.hubId || s.stationId || s.code}
              onMouseDown={(event) => { event.preventDefault(); handleSelect(s); }}
              className={`px-4 py-2.5 cursor-pointer text-sm flex justify-between${index === activeIndex ? ' is-active' : ''}`}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-gray-400 text-xs">{s.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
