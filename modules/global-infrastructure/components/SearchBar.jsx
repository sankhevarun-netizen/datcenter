'use client';
import { useState } from 'react';
import { Search, MapPin } from 'lucide-react';

export default function SearchBar({ query, onQueryChange, results, onSelectResult }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative w-full max-w-xs">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        placeholder="Search country, city, or facility..."
        aria-label="Search data centers by country, city, or facility name"
        className="w-full bg-white border border-[#D8DCE3] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1A1F36] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#005EB8]/50 transition-colors"
      />

      {focused && query.trim() && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-[#D8DCE3] rounded-xl shadow-2xl overflow-hidden z-[500]" role="listbox">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-[#9CA3AF]">No matches</p>
          ) : (
            results.map(facility => (
              <button
                key={facility.id}
                role="option"
                onClick={() => onSelectResult(facility)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F0F2F5] transition-colors border-b border-[#F0F2F5] last:border-0"
              >
                <MapPin size={11} className="text-[#005EB8] flex-shrink-0" />
                <span className="text-xs text-[#1A1F36] font-medium truncate">{facility.name}</span>
                <span className="text-[10px] text-[#9CA3AF] ml-auto flex-shrink-0">{facility.city}, {facility.country}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
