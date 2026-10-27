'use client';
import { Cloud, Droplets, Wind, AlertTriangle } from 'lucide-react';
import { SkeletonBlock } from './Skeleton';

export default function RegionalWeatherPanel({ facilities = [], weatherByDc = {}, loading = true }) {
  if (loading || facilities.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 h-32">
            <SkeletonBlock height="h-3" width="w-20" className="mb-3" />
            <SkeletonBlock height="h-8" width="w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {facilities.map(facility => {
        const w = weatherByDc[facility.id];
        if (!w) return null;
        return (
          <div key={facility.id} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{facility.city}</p>
              <Cloud size={14} className="text-[#005EB8]" />
            </div>
            <p className="text-2xl font-bold text-[#1A1F36] mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {w.current.tempC}°C
            </p>
            <p className="text-[10px] text-[#9CA3AF] mb-3">{w.current.condition} · {w.climateZone}</p>

            <div className="flex items-center gap-3 text-[10px] text-[#6B7280] mb-2">
              <span className="flex items-center gap-1"><Droplets size={11} className="text-[#005EB8]" />{w.current.humidityPct}%</span>
              <span className="flex items-center gap-1"><Wind size={11} className="text-[#9CA3AF]" />{w.current.windKph} km/h</span>
            </div>

            <div className="border-t border-[#F0F2F5] pt-2 mt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">Seasonal Outlook</p>
              <div className="grid grid-cols-4 gap-1 text-[9px] text-[#6B7280]">
                {Object.entries(w.seasonalAvgTempC).map(([q, temp]) => (
                  <span key={q} className="text-center">{q.toUpperCase()}<br /><span className="font-bold text-[#1A1F36]">{temp}°</span></span>
                ))}
              </div>
            </div>

            {w.extremeWeatherEvents?.length > 0 && w.extremeWeatherEvents[0] !== 'None recorded (5yr)' && (
              <div className="flex items-start gap-1.5 mt-2.5 bg-[#E87722]/10 rounded-lg px-2 py-1.5">
                <AlertTriangle size={11} className="text-[#E87722] flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-[#92670B]">{w.extremeWeatherEvents.join(', ')}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
