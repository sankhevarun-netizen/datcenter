'use client';
export function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#1A1F36] mb-1.5" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        {label}
        {hint && <span className="text-[#9CA3AF] font-normal ml-1.5 text-xs">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#F0F2F5] border border-[#D8DCE3] rounded-xl px-4 py-2.5 text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8]/60 focus:bg-white transition-all appearance-none cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
    >
      <option value="" disabled>{placeholder || 'Select...'}</option>
      {options.map(opt => (
        <option key={opt.value || opt} value={opt.value || opt}>
          {opt.label || opt}
        </option>
      ))}
    </select>
  );
}

export function MultiSelect({ value = [], onChange, options }) {
  const toggle = (opt) => {
    const v = value || [];
    if (v.includes(opt)) onChange(v.filter(x => x !== opt));
    else onChange([...v, opt]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const val = opt.value || opt;
        const label = opt.label || opt;
        const selected = (value || []).includes(val);
        return (
          <button
            key={val}
            type="button"
            onClick={() => toggle(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              selected
                ? 'bg-[#00338D] text-white border-[#00338D] shadow-sm'
                : 'bg-[#F0F2F5] text-[#6B7280] border-[#D8DCE3] hover:border-[#CBD5E1] hover:text-[#1A1F36]'
            }`}
          >
            {selected && <span className="mr-1">✓</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SliderField({ value, onChange, min, max, step = 1, formatValue, leftLabel, rightLabel }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        {leftLabel && <span className="text-xs text-[#9CA3AF]">{leftLabel}</span>}
        <span className="text-sm font-bold text-[#00338D] ml-auto font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {formatValue ? formatValue(value) : value}
        </span>
        {rightLabel && <span className="text-xs text-[#9CA3AF] ml-2">{rightLabel}</span>}
      </div>
      <div className="relative h-2">
        <div className="absolute inset-0 bg-[#D8DCE3] rounded-full" />
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00338D] to-[#005EB8] rounded-full"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#00338D] rounded-full border-2 border-white shadow-md"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[#CBD5E1] mt-1">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#F0F2F5] border border-[#D8DCE3] rounded-xl px-4 py-2.5 text-sm text-[#1A1F36] focus:outline-none focus:border-[#005EB8]/60 focus:bg-white transition-all placeholder:text-[#9CA3AF]"
    />
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#1A1F36]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#00338D]' : 'bg-[#D8DCE3]'}`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}
