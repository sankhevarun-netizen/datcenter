'use client';
import { useState } from 'react';
import { SlidersHorizontal, Sun, Moon, X } from 'lucide-react';
import SearchBar from '../SearchBar';
import FilterPanel from '../FilterPanel';

export default function MapToolbar({
  searchQuery, onSearchChange, searchResults, onSelectResult,
  filters, onFilterChange, onResetFilters, activeFilterCount, countries,
  mode, onModeChange, hideRegionFilter = false,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 mb-3 relative">
      <SearchBar query={searchQuery} onQueryChange={onSearchChange} results={searchResults} onSelectResult={onSelectResult} />

      <div className="relative">
        <button
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          aria-label="Toggle map filters"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            activeFilterCount > 0
              ? 'bg-[#00338D] text-white border-[#00338D]'
              : 'bg-white text-[#6B7280] border-[#D8DCE3] hover:bg-[#F0F2F5]'
          }`}
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white/20 rounded-full px-1.5 text-[10px] font-bold">{activeFilterCount}</span>
          )}
        </button>

        {filtersOpen && (
          <div className="absolute top-full left-0 mt-2 z-[600]">
            <div className="absolute -top-7 right-0">
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="text-[#9CA3AF] hover:text-[#1A1F36]">
                <X size={14} />
              </button>
            </div>
            <FilterPanel filters={filters} onFilterChange={onFilterChange} onReset={onResetFilters} countries={countries} hideRegionFilter={hideRegionFilter} />
          </div>
        )}
      </div>

      <button
        onClick={() => onModeChange(mode === 'dark' ? 'light' : 'dark')}
        aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} map mode`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#6B7280] border border-[#D8DCE3] hover:bg-[#F0F2F5] transition-colors ml-auto"
      >
        {mode === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        {mode === 'dark' ? 'Light map' : 'Dark map'}
      </button>
    </div>
  );
}
