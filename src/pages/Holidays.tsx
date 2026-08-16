import { useState, useMemo, useEffect } from 'react';
import { format, isToday, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MapPin, Flag, CalendarOff, Plus, Trash2, X } from 'lucide-react';
import { useDoctors } from '../hooks/useDoctors';
import { useLocalHolidays } from '../hooks/useLocalHolidays';
import { useApp } from '../contexts/AppContext';
import { useMunicipalHolidays } from '../hooks/useMunicipalHolidays';
import { BRAZILIAN_STATES } from '../types';
import { getNationalHolidays, getStateHolidays, BRAZILIAN_STATES_NAMES, type Holiday } from '../data/holidays';

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

interface LocalForm {
  name: string;
  day: string;
  month: string;
  city: string;
  state: string;
}

const emptyForm: LocalForm = { name: '', day: '', month: '', city: '', state: '' };

export function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { settings, updateSettings } = useApp();
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const { doctors } = useDoctors();
  const { localHolidays, addLocalHoliday, deleteLocalHoliday } = useLocalHolidays();

  useEffect(() => {
    if (settings) setSelectedStates(settings.workingStates ?? []);
  }, [settings]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<LocalForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // States that have doctors registered — shown first in the dropdown
  const doctorStates = useMemo(
    () => [...new Set(doctors.map(d => d.address.state))].sort(),
    [doctors]
  );

  // Cities grouped by state, sorted by number of doctors
  const doctorCities = useMemo(() => {
    const map = new Map<string, { city: string; state: string; count: number }>();
    for (const d of doctors) {
      const addresses = d.addresses?.length ? d.addresses.map(entry => entry.address) : [d.address];
      const uniqueDoctorCities = new Map(addresses
        .filter(address => address.city && address.state)
        .map(address => [`${address.city}|${address.state}`, { city: address.city, state: address.state }]));
      for (const [key, location] of uniqueDoctorCities) {
        const entry = map.get(key);
        if (entry) entry.count++;
        else map.set(key, { ...location, count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      return b.count - a.count;
    });
  }, [doctors]);

  const municipalCities = useMemo(
    () => doctorCities.filter(item => selectedStates.includes(item.state)).map(({ city, state }) => ({ city, state })),
    [doctorCities, selectedStates]
  );
  const municipalHolidays = useMunicipalHolidays(municipalCities, year);

  const baseHolidays = useMemo(() => {
    const combined = [
      ...getNationalHolidays(year),
      ...selectedStates.flatMap(state => getStateHolidays(year, state)),
    ];
    const unique = new Map<string, Holiday>();
    for (const holiday of combined) {
      const key = `${holiday.date.getMonth()}-${holiday.date.getDate()}-${holiday.name}`;
      const existing = unique.get(key);
      if (!existing) unique.set(key, { ...holiday, states: [...(holiday.states ?? [])] });
      else existing.states = [...new Set([...(existing.states ?? []), ...(holiday.states ?? [])])].sort();
    }
    return [...unique.values()];
  }, [year, selectedStates]);

  // Merge local holidays (always shown regardless of state filter)
  const holidays = useMemo<Holiday[]>(() => {
    const locals: Holiday[] = localHolidays
      .filter(lh => !lh.state || selectedStates.includes(lh.state))
      .map(lh => ({
      id: lh.id,
      date: new Date(year, lh.month - 1, lh.day),
      name: lh.name,
      type: 'local' as const,
      city: lh.city,
      states: lh.state ? [lh.state] : undefined,
      locations: lh.city && lh.state ? [{ city: lh.city, state: lh.state }] : undefined,
    }));
    const automaticMunicipals: Holiday[] = municipalHolidays.map(holiday => {
      const [holidayYear, month, day] = holiday.date.split('-').map(Number);
      return {
        date: new Date(holidayYear, month - 1, day),
        name: holiday.name,
        type: 'local' as const,
        city: holiday.city,
        states: [holiday.state],
        locations: [{ city: holiday.city, state: holiday.state }],
      };
    });
    const unique = new Map<string, Holiday>();
    for (const holiday of [...baseHolidays, ...automaticMunicipals, ...locals]) {
      const key = `${holiday.date.getMonth()}-${holiday.date.getDate()}-${holiday.name}`;
      const existing = unique.get(key);
      if (!existing) unique.set(key, {
        ...holiday,
        states: [...(holiday.states ?? [])],
        locations: holiday.locations ? [...holiday.locations] : undefined,
      });
      else {
        existing.states = [...new Set([...(existing.states ?? []), ...(holiday.states ?? [])])].sort();
        const locations = [...(existing.locations ?? []), ...(holiday.locations ?? [])];
        existing.locations = [...new Map(locations.map(location => [
          `${location.city}|${location.state}`,
          location,
        ])).values()].sort((a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city));
        if (holiday.city && existing.city !== holiday.city) {
          existing.city = [existing.city, holiday.city].filter(Boolean).join(', ');
        }
      }
    }
    return [...unique.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [baseHolidays, localHolidays, municipalHolidays, selectedStates, year]);

  async function toggleWorkingState(state: string) {
    const next = selectedStates.includes(state)
      ? selectedStates.filter(item => item !== state)
      : [...selectedStates, state].sort();
    setSelectedStates(next);
    await updateSettings({ workingStates: next });
  }

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
  const localCount      = holidays.filter(h => h.type === 'local').length;

  // States with doctors shown first, then the rest
  const sortedStates = useMemo(() => {
    const withDoctors    = BRAZILIAN_STATES.filter(s => doctorStates.includes(s));
    const withoutDoctors = BRAZILIAN_STATES.filter(s => !doctorStates.includes(s));
    return { withDoctors, withoutDoctors };
  }, [doctorStates]);

  async function handleSave() {
    setFormError('');
    const day = parseInt(form.day);
    const month = parseInt(form.month);
    if (!form.name.trim()) { setFormError('Informe o nome do feriado.'); return; }
    if (!form.month) { setFormError('Selecione o mês.'); return; }
    if (!form.day || isNaN(day) || day < 1 || day > 31) { setFormError('Informe um dia válido.'); return; }
    setIsSaving(true);
    try {
      await addLocalHoliday({
        name: form.name.trim(),
        month,
        day,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
      });
      setForm(emptyForm);
      setShowAddModal(false);
    } finally {
      setIsSaving(false);
    }
  }

  function localBadgeLabel(h: Holiday) {
    if (h.locations?.length) {
      return h.locations.map(location => `${location.city}/${location.state}`).join(' • ');
    }
    if ((h.states?.length ?? 0) > 1) return h.states!.join('/');
    if (h.city && h.states?.[0]) return `${h.city}/${h.states[0]}`;
    if (h.city) return h.city;
    if (h.states?.[0]) return h.states[0];
    return 'Local';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <CalendarOff className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-lg font-semibold">Feriados</h1>
          </div>
          <button
            onClick={() => { setForm(emptyForm); setFormError(''); setShowAddModal(true); }}
            className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Local
          </button>
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

        {/* Working states */}
        <div>
          <label className="text-xs text-gray-500 font-medium mb-2 block">Estados onde trabalha</label>
          <div className="flex flex-wrap gap-1.5">
            {[...sortedStates.withDoctors, ...sortedStates.withoutDoctors].map(state => {
              const selected = selectedStates.includes(state);
              return (
                <button key={state} type="button" onClick={() => toggleWorkingState(state)}
                  title={BRAZILIAN_STATES_NAMES[state]}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                  {state}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            {selectedStates.length > 0 ? `${selectedStates.length} estado${selectedStates.length > 1 ? 's' : ''} selecionado${selectedStates.length > 1 ? 's' : ''}` : 'Selecione ao menos um estado para ver feriados estaduais e locais.'}
          </p>
        </div>
      </div>

      {/* ── Summary chips ── */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 text-center">
            <p className="text-xl font-bold text-gray-900">{holidays.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Feriados</p>
          </div>
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-3 py-3 text-center">
            <p className="text-xl font-bold text-red-600">{weekdayHolidays}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Dias úteis</p>
          </div>
          <div className={`rounded-2xl border shadow-sm px-3 py-3 text-center ${selectedStates.length ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-100'}`}>
            <p className={`text-xl font-bold ${selectedStates.length ? 'text-purple-600' : 'text-gray-400'}`}>{stateHolidays}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Estaduais</p>
          </div>
          <div className={`rounded-2xl border shadow-sm px-3 py-3 text-center ${localCount > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
            <p className={`text-xl font-bold ${localCount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{localCount}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Locais</p>
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
                    selectedStates.includes(c.state)
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
                  const isLocal = h.type === 'local';

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
                        isLocal
                          ? 'bg-emerald-100 text-emerald-700'
                          : h.type === 'national'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                      }`}>
                        {isLocal
                          ? localBadgeLabel(h)
                          : h.type === 'national' ? 'Nacional' : (h.states ?? []).filter(state => selectedStates.includes(state)).join('/')}
                      </span>

                      {/* Delete button for local holidays */}
                      {isLocal && h.id && (
                        <button
                          onClick={() => deleteLocalHoliday(h.id!)}
                          className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Local Holiday Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddModal(false)} />
          <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">
            <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Adicionar feriado local</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-4 py-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Feriados locais são exibidos todos os anos na data informada.
                </p>

                {/* Name */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Nome do feriado *</label>
                  <input
                    type="text"
                    placeholder="Ex: Aniversário da cidade"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full input text-sm"
                  />
                </div>

                {/* Day + Month */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Dia *</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      placeholder="1–31"
                      value={form.day}
                      onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                      className="w-full input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Mês *</label>
                    <select
                      value={form.month}
                      onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
                      className="w-full input text-sm"
                    >
                      <option value="">Selecione</option>
                      {MONTHS.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* City + State */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Cidade</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full input text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Estado</label>
                    <select
                      value={form.state}
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                      className="w-full input text-sm"
                    >
                      <option value="">Opcional</option>
                      {sortedStates.withDoctors.length > 0 && (
                        <optgroup label="Com médicos">
                          {sortedStates.withDoctors.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Demais">
                        {sortedStates.withoutDoctors.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-600 font-medium">{formError}</p>
                )}

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors mt-1"
                >
                  {isSaving ? 'Salvando…' : 'Salvar feriado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
