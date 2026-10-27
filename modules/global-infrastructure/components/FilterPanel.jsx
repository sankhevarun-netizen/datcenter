'use client';

const FILTER_DEFS = [
  { key: 'region', label: 'Region', options: ['Americas', 'EMEA', 'APAC', 'MiddleEast'] },
  { key: 'health', label: 'Health', options: ['healthy', 'warning', 'critical'] },
  { key: 'risk', label: 'Risk', options: ['Low', 'Medium', 'High'] },
  { key: 'status', label: 'Status', options: ['Active', 'Under Construction'] },
  { key: 'capacityBand', label: 'Capacity', options: [['low', '< 80 MW'], ['mid', '80–149 MW'], ['high', '150 MW+']] },
  { key: 'renewableBand', label: 'Renewable %', options: [['low', '< 40%'], ['mid', '40–69%'], ['high', '70%+']] },
  { key: 'pueBand', label: 'PUE', options: [['low', '≤ 1.15'], ['mid', '1.16–1.30'], ['high', '> 1.30']] },
  { key: 'utilizationBand', label: 'Utilization', options: [['low', '< 50%'], ['mid', '50–79%'], ['high', '80%+']] },
];

/**
 * Shared between the global page and every regional page. `hideRegionFilter`
 * lets a regional page drop the Region select (the region is already fixed
 * by the route), without forking the component.
 */
export default function FilterPanel({ filters, onFilterChange, onReset, countries = [], hideRegionFilter = false }) {
  const defs = hideRegionFilter ? FILTER_DEFS.filter(d => d.key !== 'region') : FILTER_DEFS;

  return (
    <div className="bg-white border border-[#D8DCE3] rounded-xl shadow-xl p-4 w-72" role="group" aria-label="Map filters">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Filters</p>
        <button onClick={onReset} className="text-[10px] font-semibold text-[#005EB8] hover:underline">Reset</button>
      </div>

      <div className="space-y-3">
        {defs.map(({ key, label, options }) => (
          <div key={key}>
            <label htmlFor={`gii-filter-${key}`} className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">
              {label}
            </label>
            <select
              id={`gii-filter-${key}`}
              value={filters[key]}
              onChange={(e) => onFilterChange(key, e.target.value)}
              className="w-full text-xs bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005EB8]/50"
            >
              <option value="All">All</option>
              {options.map(opt => {
                const [value, optLabel] = Array.isArray(opt) ? opt : [opt, opt];
                return <option key={value} value={value}>{optLabel}</option>;
              })}
            </select>
          </div>
        ))}

        <div>
          <label htmlFor="gii-filter-country" className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">
            Country
          </label>
          <select
            id="gii-filter-country"
            value={filters.country}
            onChange={(e) => onFilterChange('country', e.target.value)}
            className="w-full text-xs bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005EB8]/50"
          >
            <option value="All">All</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="gii-filter-maintenance" className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">
            Maintenance
          </label>
          <select
            id="gii-filter-maintenance"
            value={filters.underMaintenance}
            onChange={(e) => onFilterChange('underMaintenance', e.target.value)}
            className="w-full text-xs bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005EB8]/50"
          >
            <option value="All">All</option>
            <option value="Yes">Under maintenance</option>
          </select>
        </div>

        <div>
          <label htmlFor="gii-filter-type" className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">
            Facility Type
          </label>
          <select
            id="gii-filter-type"
            value={filters.facilityType}
            onChange={(e) => onFilterChange('facilityType', e.target.value)}
            className="w-full text-xs bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#005EB8]/50"
          >
            <option value="All">All</option>
            <option value="Hyperscale Campus">Hyperscale Campus</option>
          </select>
        </div>
      </div>
    </div>
  );
}
