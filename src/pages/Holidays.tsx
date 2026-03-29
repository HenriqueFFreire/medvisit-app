import { useState, useMemo } from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MapPin, Flag, CalendarOff } from 'lucide-react';
import { useDoctors } from '../hooks/useDoctors';
import { BRAZILIAN_STATES } from '../types';
import { getHolidaysForYear, BRAZILIAN_STATES_NAMES } from '../data/holidays';

export function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedState, setSelectedState] = useState('');
  const { doctors } = useDoctors();

  // States that have doctors registered — shown first in the dropdown
  const doctorStates = useMemo(
    () => [...new Set(doctors.map(d => d.address.state))].sort(),
    [doctors]
  );

  // Cities grouped by state, sorted by number of doctors
  const doctorCities = useMemo(() => {
    const map = new Map<string, { city: string; state: string; count: number }>();
    for (const d of doctors) {
      const key = `${d.address.city}|${d.address.state}`;
      const entry = map.get(key);
      if (entry) entry.count++;
      else map.set(key, { city: d.address.city, state: d.address.state, count: 1 });
    }
    return [...map.values()].sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return b.count - a.count;
    });
  }, [doctors]);

  const holidays = useMemo(
    () => getHolidaysForYear(year, selectedState || undefined),
    [year, selectedState]
  );

  // Group by month (0–11)
  const byMonth = useMemo(() => {
    const groups: { month: number; holidays: typeof holidays }[] = [];
    for (let m = 0; m < 12; m++) {
      const mh = holidays.filter(h => h.date.getMonth() === m);
      if (mh.length > 0) groups.push({ month: m, holidays: mh });
    }
    return groups;
  }, [holidays]);

  const weekdayHolidays = holidays.filter(h => !isWeekend(h.date)).length;
  const stateHolidays   = holidays.filter(h => h.type === 'state').length;

  // States with doctors shown first, then the rest
  const sortedStates = useMemo(() => {
    const withDoctors    = BRAZILIAN_STATES.filter(s => doctorStates.includes(s));
    const withoutDoctors = BRAZILIAN_STATES.filter(s => !doctorStates.includes(s));
    return { withDoctors, withoutDoctors };
  }, [doctorStates]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <CalendarOff className="w-5 h-5 text-amber-600" />
          </div>
          <h1 className="text-lg font-semibold">Feriados</h1>
        </div>

        {/* Year navigation */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
          <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-gray-200 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-gray-200 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* State filter */}
        <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">Estado (feriados estaduais)</label>
          <select
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
            className="w-full input text-sm"
          >
            <option value="">Apenas feriados nacionais</option>
            {sortedStates.withDoctors.length > 0 && (
              <optgroup label="Estados com médicos cadastrados">
                {sortedStates.withDoctors.map(s => (
                  <option key={s} value={s}>{s} — {BRAZILIAN_STATES_NAMES[s]}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Demais estados">
              {sortedStates.withoutDoctors.map(s => (
                <option key={s} value={s}>{s} — {BRAZILIAN_STATES_NAMES[s]}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 text-center">
            <p className="text-xl font-bold text-gray-900">{holidays.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Feriados</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-3 py-3 text-center">
            <p className="text-xl font-bold text-red-600">{weekdayHolidays}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Dias úteis</p>
          </div>
          <div className={`rounded-2xl border shadow-sm px-3 py-3 text-center ${selectedState ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-100'}`}>
            <p className={`text-xl font-bold ${selectedState ? 'text-purple-600' : 'text-gray-400'}`}>{stateHolidays}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Estaduais</p>
          </div>
        </div>

        {/* ── Doctor cities ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-gray-700">Cidades com médicos cadastrados</p>
          </div>
          {doctorCities.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum médico cadastrado ainda</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {doctorCities.map(c => (
                <span
                  key={`${c.city}|${c.state}`}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    selectedState === c.state
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {c.city}<span className="text-[10px] opacity-60">/{c.state}</span>
                  {c.count > 1 && <span className="ml-1 text-[10px] opacity-50">({c.count})</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Holidays by month ── */}
        <div className="space-y-4 pb-8">
          {byMonth.map(({ month, holidays: mh }) => (
            <div key={month} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Month header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                <Flag className="w-3.5 h-3.5 text-amber-500" />
                <p className="text-sm font-bold text-gray-700 capitalize">
                  {format(new Date(year, month, 1), 'MMMM', { locale: ptBR })}
                </p>
                <span className="text-xs text-gray-400 ml-auto">
                  {mh.length} feriado{mh.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Holidays */}
              <div className="divide-y divide-gray-50">
                {mh.map((h, i) => {
                  const weekend = isWeekend(h.date);
                  const today   = isToday(h.date);
                  const dow     = format(h.date, 'EEE', { locale: ptBR });

                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${today ? 'bg-amber-50' : ''}`}>
                      {/* Date box */}
                      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                        today   ? 'bg-amber-500 text-white' :
                        weekend ? 'bg-gray-100 text-gray-400' :
                                  'bg-red-50 text-red-600'
                      }`}>
                        <p className="text-sm font-bold leading-none">{format(h.date, 'd')}</p>
                        <p className="text-[9px] uppercase leading-none mt-0.5">{dow}</p>
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${
                          today   ? 'text-amber-800' :
                          weekend ? 'text-gray-400'  : 'text-gray-900'
                        }`}>
                          {h.name}
                        </p>
                        {weekend && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Cai no final de semana</p>
                        )}
                      </div>

                      {/* Type badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        h.type === 'national'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {h.type === 'national' ? 'Nacional' : selectedState}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
