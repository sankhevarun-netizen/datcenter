'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';
import CCLayout from '@/components/command-center/CCLayout';
import { mockMaintenance } from '@/data/mock/index';

const TYPE_CONFIG = {
  routine:     { color: '#00B0A0', bg: '#F0FDF4', label: 'Routine' },
  significant: { color: '#E87722', bg: '#FFFBEB', label: 'Significant' },
  emergency:   { color: '#C8102E', bg: '#FEF2F2', label: 'Emergency' },
};

const DOT_COLORS = { routine: '#00B0A0', significant: '#E87722', emergency: '#C8102E' };

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function CalendarView({ events }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4); // May = 4

  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const [selectedDay, setSelectedDay] = useState(null);

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });

  const eventsByDay = {};
  events.forEach(ev => {
    const d = new Date(ev.scheduledStart);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    }
  });

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  return (
    <div className="flex gap-4">
      <div className="flex-1 bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#D8DCE3]">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#9CA3AF] hover:text-[#1A1F36] transition-colors"><ChevronLeft size={14} /></button>
          <span className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{monthName} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#9CA3AF] hover:text-[#1A1F36] transition-colors"><ChevronRight size={14} /></button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#D8DCE3]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide">{d}</div>
          ))}
        </div>
        {/* Days grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="h-16 border-b border-r border-[#F0F2F5]" />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsByDay[day] || [];
            const isSelected = selectedDay === day;
            const isToday = day === 18 && month === 4 && year === 2026;
            return (
              <button key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`h-16 border-b border-r border-[#F0F2F5] p-1.5 text-left hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-[#00338D]/5 border-[#00338D]/20' : ''}`}>
                <div className={`text-xs font-bold mb-1 w-5 h-5 rounded-full flex items-center justify-center ${isToday ? 'bg-[#00338D] text-white' : 'text-[#1A1F36]'}`}>{day}</div>
                <div className="flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <div key={j} className="w-2 h-2 rounded-full" style={{ backgroundColor: DOT_COLORS[ev.type] }} title={ev.title} />
                  ))}
                  {dayEvents.length > 3 && <span className="text-[8px] text-[#9CA3AF]">+{dayEvents.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex gap-4 px-5 py-3 border-t border-[#D8DCE3]">
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DOT_COLORS[k] }} />
              <span className="text-[10px] text-[#9CA3AF]">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panel */}
      <div className="w-72 flex-shrink-0">
        {selectedDay && selectedEvents.length > 0 ? (
          <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 space-y-3">
            <p className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              {monthName} {selectedDay}
            </p>
            {selectedEvents.map(ev => {
              const tc = TYPE_CONFIG[ev.type];
              return (
                <div key={ev.id} className="border border-[#D8DCE3] rounded-xl p-3">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span>
                  <p className="text-xs font-bold text-[#1A1F36] mb-1">{ev.title}</p>
                  <p className="text-[10px] text-[#6B7280] mb-1">{ev.facility}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{new Date(ev.scheduledStart).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} · {ev.durationHours}h</p>
                  {ev.affectedTenants.length > 0 && <p className="text-[10px] text-[#E87722] mt-1">Affects: {ev.affectedTenants.join(', ')}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-4 text-center text-[#9CA3AF]">
            <Calendar size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Click a day to see scheduled maintenance</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({ events }) {
  const sorted = [...events].sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
  return (
    <div className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#D8DCE3] bg-[#F8FAFC]">
            {['Event', 'Facility', 'Type', 'Scheduled', 'Duration', 'Impact', 'Status', 'Team'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((ev, i) => {
            const tc = TYPE_CONFIG[ev.type];
            const impactCfg = { none: { color: '#00B0A0', bg: '#F0FDF4' }, minor: { color: '#E87722', bg: '#FFFBEB' }, significant: { color: '#C8102E', bg: '#FEF2F2' } };
            const ic = impactCfg[ev.impactLevel] || impactCfg.none;
            return (
              <motion.tr key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="border-b border-[#F0F2F5] hover:bg-[#F8FAFC] transition-colors">
                <td className="px-4 py-3 max-w-48">
                  <p className="text-xs font-semibold text-[#1A1F36] truncate">{ev.title}</p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{ev.description.slice(0, 60)}…</p>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap">{ev.facility}</td>
                <td className="px-4 py-3"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: tc.bg, color: tc.color }}>{tc.label}</span></td>
                <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap font-mono">{new Date(ev.scheduledStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(ev.scheduledStart).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#1A1F36]">{ev.durationHours}h</td>
                <td className="px-4 py-3"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize whitespace-nowrap" style={{ backgroundColor: ic.bg, color: ic.color }}>{ev.impactLevel}</span></td>
                <td className="px-4 py-3"><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#6B7280] capitalize whitespace-nowrap">{ev.status}</span></td>
                <td className="px-4 py-3 text-xs text-[#9CA3AF] max-w-32 truncate">{ev.assignedTeam}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MaintenancePage() {
  const [view, setView] = useState('calendar');
  const [typeFilter, setTypeFilter] = useState('All');

  const filtered = mockMaintenance.filter(ev => typeFilter === 'All' || ev.type === typeFilter.toLowerCase());

  return (
    <CCLayout title="Maintenance">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-[#00338D]" />
            <h2 className="text-base font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Maintenance Schedule</h2>
            <span className="text-xs text-[#9CA3AF] font-medium">{mockMaintenance.length} events scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Type filter */}
            <div className="flex gap-1">
              {['All', 'Routine', 'Significant', 'Emergency'].map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${typeFilter === t ? 'bg-[#00338D] text-white' : 'bg-white border border-[#D8DCE3] text-[#6B7280] hover:bg-[#F0F2F5]'}`}>{t}</button>
              ))}
            </div>
            {/* View toggle */}
            <div className="flex bg-white border border-[#D8DCE3] rounded-lg overflow-hidden">
              <button onClick={() => setView('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'calendar' ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:bg-[#F0F2F5]'}`}>
                <Calendar size={12} /> Calendar
              </button>
              <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${view === 'list' ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:bg-[#F0F2F5]'}`}>
                <List size={12} /> List
              </button>
            </div>
          </div>
        </div>

        {view === 'calendar' ? <CalendarView events={filtered} /> : <ListView events={filtered} />}
      </div>
    </CCLayout>
  );
}
