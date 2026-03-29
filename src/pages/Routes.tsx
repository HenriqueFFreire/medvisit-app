import { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar, ChevronDown, ChevronRight, ChevronLeft, MapPin, AlertCircle, Trash2, CheckCircle2, Copy, Users, GripVertical, Pill } from 'lucide-react';
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRoutes } from '../hooks/useRoutes';
import { useDoctors } from '../hooks/useDoctors';
import { usePharmacies } from '../hooks/usePharmacies';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/common/Modal';
import { PageLoading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';
import { formatWeekRange } from '../utils/format';
import { generateWeeklyDistribution, type WeeklyRouteDistribution } from '../services/routing';
import type { RouteType, Doctor } from '../types';
import { isVisitedThisMonth } from '../components/doctors/DoctorCard';

interface PreviewDay {
  dateStr: string;
  date: Date;
  dayOfWeek: number;
  panelDoctors: Doctor[];
  suggestionDoctors: Doctor[];
}


export function RoutesPage() {
  const { routes, createRoute, deleteRoute, duplicateRoute, isLoading: loadingRoutes, refreshRoutes, getRouteSchedules } = useRoutes();
  const { doctors, isLoading: loadingDoctors } = useDoctors();
  const { pharmacies, isLoading: loadingPharmacies } = usePharmacies();
  const { settings } = useApp();

  const [showNewRouteModal, setShowNewRouteModal] = useState(false);

  // New route form state
  const [routeType, setRouteType] = useState<RouteType>('week');
  const [newRouteDay, setNewRouteDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newRouteWeek, setNewRouteWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [newRouteMonth, setNewRouteMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [visitsPerDay, setVisitsPerDay] = useState(settings?.defaultVisitsPerDay || 11);
  const [visitDuration, setVisitDuration] = useState(settings?.defaultVisitDuration || 10);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [selectedPharmacies, setSelectedPharmacies] = useState<string[]>([]);
  const [pharmaciesPerDay, setPharmaciesPerDay] = useState(3);
  const [routeName, setRouteName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Preview step
  const [isPreview, setIsPreview] = useState(false);
  const [previewDays, setPreviewDays] = useState<PreviewDay[]>([]);
  const [activeDragPreview, setActiveDragPreview] = useState<{ doctorName: string; isPanel: boolean } | null>(null);

  const previewSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );


  // Route expansion / day view
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [routeSchedulesCache, setRouteSchedulesCache] = useState<Record<string, import('../types').DailySchedule[]>>({});
  const [loadingScheduleId, setLoadingScheduleId] = useState<string | null>(null);

  const handleToggleRoute = async (routeId: string) => {
    if (expandedRouteId === routeId) {
      setExpandedRouteId(null);
      return;
    }
    setExpandedRouteId(routeId);
    if (!routeSchedulesCache[routeId]) {
      setLoadingScheduleId(routeId);
      try {
        const schedules = await getRouteSchedules(routeId);
        setRouteSchedulesCache(prev => ({ ...prev, [routeId]: schedules }));
      } finally {
        setLoadingScheduleId(null);
      }
    }
  };

  // Route management
  const [routeToManage, setRouteToManage] = useState<import('../types').Route | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetWeek, setDuplicateTargetWeek] = useState(format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7), 'yyyy-MM-dd'));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Day / week selectors for route creation
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([1, 2, 3, 4, 5]);
  const [numberOfWeeks, setNumberOfWeeks] = useState(1);
  const [multiWeekDistributions, setMultiWeekDistributions] = useState<WeeklyRouteDistribution[]>([]);

  const [showUnroutedPanel, setShowUnroutedPanel] = useState(false);

  // Month navigation
  const [currentViewMonth, setCurrentViewMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set());
  const [excludedMornings, setExcludedMornings] = useState<Set<string>>(new Set());
  const [excludedAfternoons, setExcludedAfternoons] = useState<Set<string>>(new Set());
  const [pendingExclusionDate, setPendingExclusionDate] = useState<string | null>(null);

  // Doctor filter state
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [onlyUnvisitedModal, setOnlyUnvisitedModal] = useState(false);
  const [lockedState, setLockedState] = useState<string>(''); // state locked after first doctor selection

  const [weeklyDistribution, setWeeklyDistribution] = useState<WeeklyRouteDistribution | null>(null);

  const isLoading = loadingRoutes || loadingDoctors || loadingPharmacies;

  // Generate weekly distribution when doctors are selected (for week/month types)
  useEffect(() => {
    if (routeType !== 'day' && selectedDoctors.length > 0) {
      const selectedDoctorsList = doctors.filter(d => selectedDoctors.includes(d.id));
      if (routeType === 'week' && numberOfWeeks > 1) {
        const perWeek = Math.ceil(selectedDoctorsList.length / numberOfWeeks);
        const dists: WeeklyRouteDistribution[] = [];
        for (let w = 0; w < numberOfWeeks; w++) {
          const weekDocs = selectedDoctorsList.slice(w * perWeek, (w + 1) * perWeek);
          dists.push(generateWeeklyDistribution(weekDocs, visitsPerDay));
        }
        setMultiWeekDistributions(dists);
        setWeeklyDistribution(dists[0] || null);
        
      } else {
        const distribution = generateWeeklyDistribution(selectedDoctorsList, visitsPerDay);
        setWeeklyDistribution(distribution);
        setMultiWeekDistributions([]);
      }
    } else {
      setWeeklyDistribution(null);
      setMultiWeekDistributions([]);
    }
  }, [selectedDoctors, doctors, visitsPerDay, routeType, numberOfWeeks]);

  const computePreview = (): PreviewDay[] => {
    const selectedDoctorObjects = doctors.filter(d => selectedDoctors.includes(d.id));
    const allPanelDocs = selectedDoctorObjects.filter(d => d.hasPanel !== false);
    const allSuggestionDocs = selectedDoctorObjects.filter(d => d.hasPanel === false);

    const applyExclusions = (docs: Doctor[], dateStr: string, dow: number) => {
      let filtered = docs;
      if (excludedMornings.has(dateStr))
        filtered = filtered.filter(d => { const wh = d.workingHours.find(w => w.dayOfWeek === dow); return !wh || wh.period !== 'M'; });
      if (excludedAfternoons.has(dateStr))
        filtered = filtered.filter(d => { const wh = d.workingHours.find(w => w.dayOfWeek === dow); return !wh || wh.period !== 'T'; });
      return filtered;
    };

    if (routeType === 'day') {
      const date = new Date(newRouteDay + 'T12:00:00');
      const dow = date.getDay();
      return [{
        dateStr: newRouteDay, date, dayOfWeek: dow,
        panelDoctors: applyExclusions(allPanelDocs, newRouteDay, dow),
        suggestionDoctors: applyExclusions(allSuggestionDocs, newRouteDay, dow),
      }];
    }

    const weekStart = startOfWeek(newRouteWeek, { weekStartsOn: 1 });

    return plannedDates
      .filter(ds => !excludedDates.has(ds))
      .map(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        const dow = date.getDay();
        let basePanelDocs = allPanelDocs;
        if (multiWeekDistributions.length > 0) {
          const weekIdx = Math.floor((date.getTime() - weekStart.getTime()) / 604800000);
          const distrib = multiWeekDistributions[Math.max(0, Math.min(multiWeekDistributions.length - 1, weekIdx))];
          basePanelDocs = (distrib?.[dow] ?? []).filter(d => d.hasPanel !== false);
        } else if (weeklyDistribution) {
          basePanelDocs = (weeklyDistribution[dow] ?? []).filter(d => d.hasPanel !== false);
        }
        return {
          dateStr, date, dayOfWeek: dow,
          panelDoctors: applyExclusions(basePanelDocs, dateStr, dow),
          suggestionDoctors: applyExclusions(allSuggestionDocs, dateStr, dow),
        };
      });
  };

  const handleGeneratePreview = () => {
    if (selectedDoctors.length === 0) return;
    const days = computePreview();
    setPreviewDays(days);
    setIsPreview(true);
  };

  const handleRemoveDoctorFromDay = (dateStr: string, doctorId: string, type: 'panel' | 'suggestion') => {
    setPreviewDays(prev => prev.map(day => {
      if (day.dateStr !== dateStr) return day;
      if (type === 'panel') return { ...day, panelDoctors: day.panelDoctors.filter(d => d.id !== doctorId) };
      return { ...day, suggestionDoctors: day.suggestionDoctors.filter(d => d.id !== doctorId) };
    }));
  };

  const handleConfirmRoute = async () => {
    setIsCreating(true);
    setCreateError('');
    try {
      let startDate: Date;
      if (routeType === 'day') startDate = new Date(newRouteDay + 'T12:00:00');
      else if (routeType === 'week') startDate = newRouteWeek;
      else startDate = new Date(newRouteMonth + '-15T12:00:00');

      const allDocIds = [...new Set(previewDays.flatMap(d => [
        ...d.panelDoctors.map(doc => doc.id),
        ...d.suggestionDoctors.map(doc => doc.id),
      ]))];

      await createRoute({
        name: routeName.trim() || undefined,
        routeType,
        startDate,
        visitsPerDay,
        visitDuration,
        doctorIds: allDocIds,
        pharmacyIds: selectedPharmacies.length > 0 ? selectedPharmacies : undefined,
        pharmaciesPerDay: selectedPharmacies.length > 0 ? pharmaciesPerDay : undefined,
        perDateAssignment: previewDays.map(d => ({
          dateStr: d.dateStr,
          panelDoctorIds: d.panelDoctors.map(doc => doc.id),
          suggestionDoctorIds: d.suggestionDoctors.map(doc => doc.id),
        })),
      });

      setShowNewRouteModal(false);
      setIsPreview(false);
      setPreviewDays([]);
      setSelectedDoctors([]);
      setSelectedPharmacies([]);
      setWeeklyDistribution(null);
      await refreshRoutes();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar roteiro. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };


  const toggleDoctorSelection = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    setSelectedDoctors(prev => {
      if (prev.includes(doctorId)) {
        const next = prev.filter(id => id !== doctorId);
        if (next.length === 0) setLockedState('');
        return next;
      }
      // Lock to this doctor's state on first selection
      if (prev.length === 0 && doctor?.address.state) {
        setLockedState(doctor.address.state);
      }
      return [...prev, doctorId];
    });
  };

  const clearSelection = () => {
    setSelectedDoctors([]);
    setLockedState('');
  };

  const availableStates = useMemo(() =>
    [...new Set(doctors.map(d => d.address.state).filter(Boolean))].sort(),
    [doctors]
  );

  const availableCities = useMemo(() =>
    [...new Set(
      doctors
        .filter(d => !filterState || d.address.state === filterState)
        .map(d => d.address.city)
        .filter(Boolean)
    )].sort(),
    [doctors, filterState]
  );

  const filteredDoctors = useMemo(() =>
    doctors.filter(d =>
      (!filterState || d.address.state === filterState) &&
      (!filterCity || d.address.city === filterCity) &&
      (!onlyUnvisitedModal || !isVisitedThisMonth(d)) &&
      (!lockedState || d.address.state === lockedState)
    ),
    [doctors, filterState, filterCity, onlyUnvisitedModal, lockedState]
  );

  // Doctors with no route this month (must be before early return — Rules of Hooks)
  const unroutedDoctors = useMemo(() => {
    const now = new Date();
    return doctors.filter(d => {
      if (!d.lastRoutedDate) return true;
      const lr = new Date(d.lastRoutedDate);
      return lr.getFullYear() !== now.getFullYear() || lr.getMonth() !== now.getMonth();
    });
  }, [doctors]);

  // Routes filtered by currently viewed month
  const filteredRoutes = useMemo(() => {
    const monthStart = startOfMonth(parseISO(currentViewMonth + '-01'));
    const monthEnd = endOfMonth(monthStart);
    return routes.filter(r => {
      const rs = new Date(r.weekStartDate);
      const re = new Date(r.weekEndDate);
      return rs <= monthEnd && re >= monthStart;
    });
  }, [routes, currentViewMonth]);

  // Progress stats from cached schedules
  const getRouteProgress = (routeId: string) => {
    const schedules = routeSchedulesCache[routeId];
    if (!schedules) return null;
    const total = schedules.reduce((s, sc) => s + sc.visits.filter(v => !v.isSuggestion).length, 0);
    const done = schedules.reduce((s, sc) => s + sc.visits.filter(v => !v.isSuggestion && (v.status === 'completed' || v.status === 'not_done' || v.status === 'rescheduled')).length, 0);
    return { total, done };
  };

  const plannedDates = useMemo(() => {
    const dates: string[] = [];
    const active = selectedDays;
    if (routeType === 'week') {
      for (let w = 0; w < numberOfWeeks; w++) {
        for (let d = 0; d < 5; d++) {
          const date = addDays(addDays(newRouteWeek, w * 7), d);
          const dow = date.getDay();
          if (active.includes(dow)) dates.push(format(date, 'yyyy-MM-dd'));
        }
      }
    } else if (routeType === 'month') {
      const ms = startOfMonth(new Date(newRouteMonth + '-15T12:00:00'));
      const me = endOfMonth(ms);
      let cur = ms;
      while (cur <= me) {
        const dow = cur.getDay();
        if (dow >= 1 && dow <= 5 && active.includes(dow)) {
          const firstMon = startOfWeek(startOfMonth(cur), { weekStartsOn: 1 });
          const wk = Math.floor((cur.getTime() - firstMon.getTime()) / (7 * 86400000)) + 1;
          if (selectedWeeks.includes(wk)) dates.push(format(cur, 'yyyy-MM-dd'));
        }
        cur = addDays(cur, 1);
      }
    }
    return dates;
  }, [routeType, numberOfWeeks, newRouteWeek, selectedDays, selectedWeeks, newRouteMonth]);

  const groupedByWeek = useMemo((): [string, string[]][] => {
    const groups: Record<string, string[]> = {};
    for (const ds of plannedDates) {
      const d = new Date(ds + 'T12:00:00');
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!groups[wk]) groups[wk] = [];
      groups[wk].push(ds);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [plannedDates]);

  // Month calendar grid: array of weeks, each with 5 days (Mon–Fri) + actual dates
  const monthCalendarGrid = useMemo(() => {
    if (routeType !== 'month') return [];
    const monthStart = startOfMonth(new Date(newRouteMonth + '-15T12:00:00'));
    const monthEnd = endOfMonth(monthStart);
    const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 });
    const dowLabels = ['S', 'T', 'Q', 'Q', 'S'];
    const weeks: Array<{ weekNum: number; days: Array<{ dateStr: string; date: Date; inMonth: boolean; dowLabel: string }> }> = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      for (let d = 0; d < 5; d++) {
        const date = addDays(firstMonday, w * 7 + d);
        days.push({ dateStr: format(date, 'yyyy-MM-dd'), date, inMonth: date >= monthStart && date <= monthEnd, dowLabel: dowLabels[d] });
      }
      if (days.some(d => d.inMonth)) weeks.push({ weekNum: w + 1, days });
    }
    return weeks;
  }, [routeType, newRouteMonth]);

  const handleDeleteRoute = async () => {
    if (!routeToManage) return;
    setIsDeleting(true);
    try {
      await deleteRoute(routeToManage.id);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateRoute = async () => {
    if (!routeToManage) return;
    setIsDuplicating(true);
    try {
      const targetDate = new Date(duplicateTargetWeek + 'T12:00:00');
      const newWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
      await duplicateRoute(routeToManage.id, newWeekStart);
      setShowDuplicateModal(false);
    } finally {
      setIsDuplicating(false);
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  // Route type label helper
  const getRouteTypeLabel = (type: string) => {
    if (type === 'day') return 'Dia';
    if (type === 'month') return 'Mês';
    return 'Semana';
  };

  const getRouteDateLabel = (route: import('../types').Route) => {
    if (route.routeType === 'month') {
      return format(route.weekStartDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
    return formatWeekRange(route.weekStartDate, route.weekEndDate);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold">Roteiros</h1>
          <button
            onClick={() => setShowNewRouteModal(true)}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Roteiro
          </button>
        </div>
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentViewMonth(format(subMonths(parseISO(currentViewMonth + '-01'), 1), 'yyyy-MM'))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-gray-700 capitalize">
            {format(parseISO(currentViewMonth + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}
            {filteredRoutes.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {filteredRoutes.length} roteiro{filteredRoutes.length > 1 ? 's' : ''}
              </span>
            )}
          </span>
          <button
            onClick={() => setCurrentViewMonth(format(addMonths(parseISO(currentViewMonth + '-01'), 1), 'yyyy-MM'))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Unrouted doctors panel */}
        {unroutedDoctors.length > 0 && (
          <div className="border border-orange-200 bg-orange-50 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 text-left"
              onClick={() => setShowUnroutedPanel(v => !v)}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-sm font-semibold text-orange-700">
                  {unroutedDoctors.length} médico{unroutedDoctors.length > 1 ? 's' : ''} sem roteiro este mês
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 text-orange-400 transition-transform ${showUnroutedPanel ? 'rotate-90' : ''}`} />
            </button>
            {showUnroutedPanel && (() => {
              // Group by state → city
              const grouped: Record<string, Record<string, typeof unroutedDoctors>> = {};
              for (const d of unroutedDoctors) {
                const st = d.address.state || 'Outro';
                const ci = d.address.city || 'Outra';
                if (!grouped[st]) grouped[st] = {};
                if (!grouped[st][ci]) grouped[st][ci] = [];
                grouped[st][ci].push(d);
              }
              return (
                <div className="border-t border-orange-200 px-3 py-3 space-y-3 max-h-64 overflow-y-auto">
                  {Object.entries(grouped).sort().map(([state, cities]) => (
                    <div key={state}>
                      <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wide mb-1.5">{state}</p>
                      {Object.entries(cities).sort().map(([city, docs]) => (
                        <div key={city} className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">{city}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 bg-white rounded-full px-1.5 py-0.5 border border-orange-200">
                                {docs.filter(d => d.hasPanel !== false).length} painel · {docs.filter(d => d.hasPanel === false).length} sugestão
                              </span>
                              <button
                                onClick={() => {
                                  setShowUnroutedPanel(false);
                                  setShowNewRouteModal(true);
                                  setSelectedDoctors(docs.map(d => d.id));
                                }}
                                className="text-[10px] text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-md px-2 py-0.5 font-medium transition-colors"
                              >
                                + Roteiro
                              </button>
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-1">
                            {docs.map(d => (
                              <div key={d.id} className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.hasPanel === false ? 'bg-orange-400' : 'bg-green-500'}`} />
                                <p className="text-xs text-gray-700 truncate">{d.name}</p>
                                {d.hasPanel === false && (
                                  <span className="text-[9px] text-orange-600 shrink-0">sem painel</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setShowUnroutedPanel(false);
                      setShowNewRouteModal(true);
                      setSelectedDoctors(unroutedDoctors.map(d => d.id));
                    }}
                    className="w-full text-xs text-orange-700 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-lg py-1.5 font-medium transition-colors"
                  >
                    <Users className="w-3 h-3 inline mr-1" />
                    Criar roteiro com todos ({unroutedDoctors.length})
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Routes list */}
        {routes.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhum roteiro criado"
            description="Crie seu primeiro roteiro para organizar suas visitas."
            action={
              <button onClick={() => setShowNewRouteModal(true)} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Criar Roteiro
              </button>
            }
          />
        ) : filteredRoutes.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum roteiro para este mês</p>
            <button
              onClick={() => setShowNewRouteModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Criar roteiro
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoutes.map(route => {
              const isExpanded = expandedRouteId === route.id;
              const isLoadingSched = loadingScheduleId === route.id;
              const schedules = routeSchedulesCache[route.id] || [];
              const progress = getRouteProgress(route.id);
              return (
              <div key={route.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header — click to expand */}
                <button
                  className="w-full flex items-start justify-between px-4 pt-4 pb-3 text-left"
                  onClick={() => handleToggleRoute(route.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        route.routeType === 'month' ? 'bg-indigo-100 text-indigo-700'
                        : route.routeType === 'day' ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getRouteTypeLabel(route.routeType)}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        route.status === 'completed' ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {route.status === 'completed' ? 'Concluído' : 'Ativo'}
                      </span>
                    </div>
                    {route.name && (
                      <p className="font-bold text-gray-900 text-sm">{route.name}</p>
                    )}
                    <p className={`capitalize text-sm ${route.name ? 'text-gray-500 font-normal' : 'font-semibold text-gray-900'}`}>
                      {getRouteDateLabel(route)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {route.visitsPerDay} visitas/dia · {route.visitDuration} min cada
                    </p>
                    {/* Progress bar */}
                    {progress && progress.total > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500">
                            {progress.done} / {progress.total} visitas
                          </span>
                          <span className="text-[10px] font-semibold text-gray-600">
                            {Math.round((progress.done / progress.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${(progress.done / progress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                  }
                </button>

                {/* Day grid — shown when expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {isLoadingSched ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">Carregando...</div>
                    ) : schedules.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400 text-center">Sem dias agendados</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div className="flex gap-2 px-3 py-3" style={{ minWidth: `${schedules.length * 130}px` }}>
                          {schedules.map(sched => {
                            const panelVisits = sched.visits.filter(v => !v.isSuggestion);
                            const suggestionVisits = sched.visits.filter(v => v.isSuggestion);
                            const morning = panelVisits.filter(v => {
                              const wh = v.doctor?.workingHours.find(w => w.dayOfWeek === sched.dayOfWeek);
                              return !wh || wh.period === 'M' || wh.period === 'MT' || wh.period === 'AG';
                            });
                            const afternoon = panelVisits.filter(v => {
                              const wh = v.doctor?.workingHours.find(w => w.dayOfWeek === sched.dayOfWeek);
                              return wh?.period === 'T';
                            });
                            const isToday = format(sched.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            return (
                              <div
                                key={sched.id}
                                className={`flex-shrink-0 w-32 rounded-xl border overflow-hidden ${
                                  isToday ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'
                                }`}
                              >
                                {/* Day header */}
                                <div className={`px-2 py-1.5 text-center ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                                  <p className="text-[11px] font-bold capitalize">
                                    {format(sched.date, 'EEE', { locale: ptBR })}
                                  </p>
                                  <p className={`text-[10px] ${isToday ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {format(sched.date, 'd/MM')}
                                  </p>
                                  <p className={`text-[10px] font-semibold mt-0.5 ${isToday ? 'text-blue-200' : 'text-gray-500'}`}>
                                    {panelVisits.length} méd.{suggestionVisits.length > 0 ? ` +${suggestionVisits.length}` : ''}
                                  </p>
                                </div>
                                {/* Panel doctors */}
                                <div className="p-1.5 space-y-1 bg-white">
                                  {morning.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-0.5 mb-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                        <span className="text-[8px] font-bold text-amber-600 uppercase">Manhã</span>
                                      </div>
                                      {morning.map(v => (
                                        <p key={v.id} className="text-[10px] text-gray-700 truncate leading-tight pl-2">
                                          {v.doctor?.name ?? '—'}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {afternoon.length > 0 && (
                                    <div className={morning.length > 0 ? 'mt-1' : ''}>
                                      <div className="flex items-center gap-0.5 mb-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span className="text-[8px] font-bold text-blue-600 uppercase">Tarde</span>
                                      </div>
                                      {afternoon.map(v => (
                                        <p key={v.id} className="text-[10px] text-gray-700 truncate leading-tight pl-2">
                                          {v.doctor?.name ?? '—'}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {/* Suggestion doctors */}
                                  {suggestionVisits.length > 0 && (
                                    <div className={`mt-1 pt-1 border-t border-orange-100`}>
                                      <div className="flex items-center gap-0.5 mb-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />
                                        <span className="text-[8px] font-bold text-orange-500 uppercase">Sugestão</span>
                                      </div>
                                      {suggestionVisits.map(v => (
                                        <p key={v.id} className="text-[10px] text-orange-600 truncate leading-tight pl-2 opacity-80">
                                          {v.doctor?.name ?? '—'}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex border-t border-gray-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setRouteToManage(route); setShowDuplicateModal(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    Aplicar
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setRouteToManage(route); setShowDeleteConfirm(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Route Modal */}
      <Modal
        isOpen={showNewRouteModal}
        onClose={() => {
          setShowNewRouteModal(false);
          setRouteName('');
          setIsPreview(false);
          setPreviewDays([]);
          setWeeklyDistribution(null);
          setSelectedDoctors([]);
          setSelectedPharmacies([]);
          setCreateError('');
          setOnlyUnvisitedModal(false);
          setLockedState('');
          setSelectedDays([1, 2, 3, 4, 5]);
          setSelectedWeeks([1, 2, 3, 4, 5]);
          setNumberOfWeeks(1);
          setMultiWeekDistributions([]);

          setExcludedDates(new Set());
          setExcludedMornings(new Set());
          setExcludedAfternoons(new Set());
          setPendingExclusionDate(null);
        }}
        title={isPreview ? 'Pré-visualização do Roteiro' : 'Novo Roteiro'}
        size="full"
      >
        <div className="space-y-6">
          {/* ── Step 1: form (hidden in preview mode) ── */}
          {!isPreview && <div>
          {/* Route Name */}
          <div>
            <label className="label">Nome do roteiro <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Zona Sul – Março"
              value={routeName}
              onChange={e => setRouteName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Route Type Selector */}
          <div>
            <label className="label">Tipo de Roteiro</label>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as RouteType[]).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    setRouteType(type);
                    setSelectedDoctors([]);
                    setWeeklyDistribution(null);
                    setNumberOfWeeks(1);
                    setMultiWeekDistributions([]);
                    
                    setExcludedDates(new Set());
                    setExcludedMornings(new Set());
                    setExcludedAfternoons(new Set());
                    setPendingExclusionDate(null);
                    if (type === 'month') {
                      setSelectedDays([1, 2, 3, 4, 5]);
                      setSelectedWeeks([1, 2, 3, 4, 5]);
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    routeType === type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type === 'day' ? 'Dia' : type === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">
                {routeType === 'day' ? 'Data' : routeType === 'week' ? 'Semana' : 'Mês'}
              </label>
              {routeType === 'day' && (
                <input
                  type="date"
                  className="input"
                  value={newRouteDay}
                  onChange={e => setNewRouteDay(e.target.value)}
                />
              )}
              {routeType === 'week' && (
                <>
                  <input
                    type="date"
                    className="input"
                    value={format(newRouteWeek, 'yyyy-MM-dd')}
                    onChange={e => {
                      const date = new Date(e.target.value + 'T12:00:00');
                      setNewRouteWeek(startOfWeek(date, { weekStartsOn: 1 }));
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formatWeekRange(newRouteWeek, addDays(newRouteWeek, 4))}
                  </p>
                </>
              )}
              {routeType === 'month' && (
                <input
                  type="month"
                  className="input"
                  value={newRouteMonth}
                  onChange={e => setNewRouteMonth(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="label">Visitas por dia</label>
              <input
                type="number"
                className="input"
                min={1}
                max={20}
                value={visitsPerDay}
                onChange={e => setVisitsPerDay(parseInt(e.target.value))}
              />
            </div>

            <div>
              <label className="label">Duração da visita (min)</label>
              <input
                type="number"
                className="input"
                min={5}
                max={120}
                step={5}
                value={visitDuration}
                onChange={e => setVisitDuration(parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Number of weeks selector (week type only) */}
          {routeType === 'week' && (
            <div>
              <label className="label">Número de semanas consecutivas</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setNumberOfWeeks(n);
                      setWeeklyDistribution(null);
                      setMultiWeekDistributions([]);
                      
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      numberOfWeeks === n
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {n === 1 ? '1 sem' : `${n} sem`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day selectors (week type only) */}
          {routeType === 'week' && (
            <div>
              <label className="label">Dias da semana</label>
              <div className="flex gap-2">
                {[
                  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
                  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }
                ].map(({ v, l }) => {
                  const active = selectedDays.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedDays(prev =>
                        active ? prev.filter(d => d !== v) : [...prev, v].sort()
                      )}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month calendar grid — replaces day/week selectors for month type */}
          {routeType === 'month' && monthCalendarGrid.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Calendário do mês</label>
                {(excludedDates.size > 0 || excludedMornings.size > 0 || excludedAfternoons.size > 0) && (
                  <span className="text-xs text-red-500 font-medium">
                    {[
                      excludedDates.size > 0 && `${excludedDates.size} dia${excludedDates.size > 1 ? 's' : ''}`,
                      (excludedMornings.size + excludedAfternoons.size) > 0 && `${excludedMornings.size + excludedAfternoons.size} turno${(excludedMornings.size + excludedAfternoons.size) > 1 ? 's' : ''}`
                    ].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2">Toque num dia para excluí-lo ou remover um turno</p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {monthCalendarGrid.map(({ weekNum, days }) => (
                  <div key={weekNum} className="border-b border-gray-100 last:border-0">
                    {/* Week row */}
                    <div className="flex items-center">
                      <span className="w-7 shrink-0 text-[10px] text-gray-400 font-semibold text-center">{weekNum}ª</span>
                      <div className="flex flex-1 gap-1 p-1.5">
                        {days.map(({ dateStr, date, inMonth, dowLabel }) => {
                          if (!inMonth) return <div key={dateStr} className="flex-1" />;
                          const fullExcluded = excludedDates.has(dateStr);
                          const mExcluded = excludedMornings.has(dateStr);
                          const tExcluded = excludedAfternoons.has(dateStr);
                          const isAnyExcluded = fullExcluded || mExcluded || tExcluded;
                          const isPending = pendingExclusionDate === dateStr;
                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => {
                                if (isAnyExcluded) {
                                  setExcludedDates(p => { const n = new Set(p); n.delete(dateStr); return n; });
                                  setExcludedMornings(p => { const n = new Set(p); n.delete(dateStr); return n; });
                                  setExcludedAfternoons(p => { const n = new Set(p); n.delete(dateStr); return n; });
                                  setPendingExclusionDate(null);
                                } else if (isPending) {
                                  setPendingExclusionDate(null);
                                } else {
                                  setPendingExclusionDate(dateStr);
                                }
                              }}
                              className={`flex-1 rounded-lg py-1.5 text-center transition-all border ${
                                fullExcluded
                                  ? 'bg-red-50 border-red-200 opacity-60'
                                  : mExcluded && tExcluded
                                  ? 'bg-orange-50 border-orange-300'
                                  : mExcluded
                                  ? 'bg-amber-50 border-amber-300'
                                  : tExcluded
                                  ? 'bg-indigo-50 border-indigo-300'
                                  : isPending
                                  ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-300'
                                  : 'bg-blue-50 border-blue-100 hover:bg-blue-100'
                              }`}
                            >
                              <div className={`text-[11px] font-bold leading-tight ${
                                fullExcluded ? 'text-red-400 line-through' :
                                mExcluded || tExcluded ? 'text-orange-600' : 'text-blue-700'
                              }`}>{dowLabel}</div>
                              <div className={`text-[10px] leading-tight ${fullExcluded ? 'text-red-300' : 'text-gray-500'}`}>
                                {format(date, 'd')}
                              </div>
                              {(mExcluded || tExcluded) && !fullExcluded && (
                                <div className="text-[8px] text-orange-500 font-bold leading-tight">
                                  {mExcluded && tExcluded ? 'M+T' : mExcluded ? 'M' : 'T'}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Exclusion choice bar — appears below the row of the tapped day */}
                    {pendingExclusionDate && days.some(d => d.dateStr === pendingExclusionDate) && (
                      <div className="flex items-center gap-1.5 px-2 py-2 bg-gray-50 border-t border-gray-100">
                        <span className="text-[11px] text-gray-600 font-medium capitalize shrink-0">
                          {format(new Date(pendingExclusionDate + 'T12:00:00'), "EEE d/MM", { locale: ptBR })}:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setExcludedDates(p => { const n = new Set(p); n.add(pendingExclusionDate!); return n; });
                            setPendingExclusionDate(null);
                          }}
                          className="flex-1 bg-red-500 text-white text-xs font-semibold py-1.5 rounded-lg"
                        >Dia inteiro</button>
                        <button
                          type="button"
                          onClick={() => {
                            setExcludedMornings(p => { const n = new Set(p); n.add(pendingExclusionDate!); return n; });
                            setPendingExclusionDate(null);
                          }}
                          className="flex-1 bg-amber-400 text-white text-xs font-semibold py-1.5 rounded-lg"
                        >Manhã</button>
                        <button
                          type="button"
                          onClick={() => {
                            setExcludedAfternoons(p => { const n = new Set(p); n.add(pendingExclusionDate!); return n; });
                            setPendingExclusionDate(null);
                          }}
                          className="flex-1 bg-blue-500 text-white text-xs font-semibold py-1.5 rounded-lg"
                        >Tarde</button>
                        <button type="button" onClick={() => setPendingExclusionDate(null)} className="text-gray-400 hover:text-gray-600 px-1 text-base leading-none">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar exclusion — shown only for week type */}
          {routeType === 'week' && plannedDates.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Calendário de visitas</label>
                {(excludedDates.size > 0 || excludedMornings.size > 0 || excludedAfternoons.size > 0) && (
                  <span className="text-xs text-red-600 font-medium">
                    {excludedDates.size > 0 && `${excludedDates.size} dia${excludedDates.size > 1 ? 's' : ''}`}
                    {excludedDates.size > 0 && (excludedMornings.size > 0 || excludedAfternoons.size > 0) && ' · '}
                    {(excludedMornings.size > 0 || excludedAfternoons.size > 0) && `${excludedMornings.size + excludedAfternoons.size} turno${excludedMornings.size + excludedAfternoons.size > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2">Toque no dia para excluir · [M] manhã · [T] tarde</p>
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-2.5">
                {groupedByWeek.map(([weekStart, days]: [string, string[]]) => {
                  const ws = new Date(weekStart + 'T12:00:00');
                  const we = addDays(ws, 4);
                  return (
                    <div key={weekStart}>
                      <p className="text-[10px] text-gray-400 font-medium mb-1.5 px-0.5">
                        {format(ws, 'd/MM', { locale: ptBR })} – {format(we, 'd/MM', { locale: ptBR })}
                      </p>
                      <div className="flex gap-1">
                        {days.map(ds => {
                          const fullExcluded = excludedDates.has(ds);
                          const mExcluded = excludedMornings.has(ds);
                          const tExcluded = excludedAfternoons.has(ds);
                          const d = new Date(ds + 'T12:00:00');
                          return (
                            <div
                              key={ds}
                              className={`flex-1 min-w-0 rounded-lg border overflow-hidden ${
                                fullExcluded ? 'bg-red-50 border-red-200 opacity-60' : 'bg-white border-gray-200'
                              }`}
                            >
                              {/* Day header — click to toggle full-day exclusion */}
                              <button
                                type="button"
                                onClick={() => {
                                  setExcludedDates(prev => {
                                    const next = new Set(prev);
                                    if (next.has(ds)) next.delete(ds); else next.add(ds);
                                    return next;
                                  });
                                  // Clear shift exclusions when excluding full day
                                  if (!fullExcluded) {
                                    setExcludedMornings(prev => { const n = new Set(prev); n.delete(ds); return n; });
                                    setExcludedAfternoons(prev => { const n = new Set(prev); n.delete(ds); return n; });
                                  }
                                }}
                                className={`w-full pt-1.5 pb-0.5 text-center ${fullExcluded ? '' : 'hover:bg-gray-50 active:bg-gray-100'}`}
                              >
                                <div className={`font-semibold text-[11px] capitalize leading-tight ${fullExcluded ? 'text-red-400 line-through' : 'text-gray-700'}`}>
                                  {format(d, 'EEE', { locale: ptBR })}
                                </div>
                                <div className={`text-[10px] leading-tight ${fullExcluded ? 'text-red-400' : 'text-gray-400'}`}>
                                  {format(d, 'd/MM')}
                                </div>
                              </button>
                              {/* Shift buttons */}
                              <div className="flex gap-0.5 px-0.5 pb-1 mt-1">
                                <button
                                  type="button"
                                  disabled={fullExcluded}
                                  onClick={() => setExcludedMornings(prev => {
                                    const next = new Set(prev);
                                    if (next.has(ds)) next.delete(ds); else next.add(ds);
                                    return next;
                                  })}
                                  className={`flex-1 rounded text-[9px] font-bold py-0.5 transition-colors ${
                                    fullExcluded ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                                    mExcluded ? 'bg-amber-400 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                  }`}
                                >
                                  M
                                </button>
                                <button
                                  type="button"
                                  disabled={fullExcluded}
                                  onClick={() => setExcludedAfternoons(prev => {
                                    const next = new Set(prev);
                                    if (next.has(ds)) next.delete(ds); else next.add(ds);
                                    return next;
                                  })}
                                  className={`flex-1 rounded text-[9px] font-bold py-0.5 transition-colors ${
                                    fullExcluded ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                                    tExcluded ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  }`}
                                >
                                  T
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Doctor Selection */}
          <div>
              {/* Unvisited toggle */}
              <button
                onClick={() => setOnlyUnvisitedModal(v => !v)}
                className={`flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm font-medium mb-3 border transition-colors ${
                  onlyUnvisitedModal
                    ? 'bg-orange-50 text-orange-700 border-orange-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {onlyUnvisitedModal ? 'Mostrando apenas não visitados este mês' : 'Mostrar apenas não visitados este mês'}
              </button>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="label text-xs">Filtrar por estado</label>
                  <select
                    className="input text-sm"
                    value={filterState}
                    onChange={e => { setFilterState(e.target.value); setFilterCity(''); }}
                  >
                    <option value="">Todos os estados</option>
                    {availableStates.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Filtrar por cidade</label>
                  <select
                    className="input text-sm"
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                  >
                    <option value="">Todas as cidades</option>
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Locked state banner */}
              {lockedState && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-2">
                  <span className="text-xs font-medium text-orange-700">
                    Roteiro restrito ao estado: <strong>{lockedState}</strong>
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-orange-600 hover:text-orange-800 underline ml-2"
                  >
                    Limpar seleção
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  {routeType === 'day'
                    ? `Médicos para o dia (${selectedDoctors.length})`
                    : `Selecionar Médicos (${selectedDoctors.length}/${filteredDoctors.length})`}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const ids = filteredDoctors.map(d => d.id);
                      if (ids.length > 0 && !lockedState) {
                        setLockedState(filteredDoctors[0].address.state);
                      }
                      setSelectedDoctors(ids);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Selecionar filtrados
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredDoctors.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {doctors.length === 0 ? 'Nenhum médico cadastrado' : 'Nenhum médico encontrado com este filtro'}
                  </div>
                ) : (() => {
                  const panelDocs = filteredDoctors.filter(d => d.hasPanel !== false);
                  const suggestionDocs = filteredDoctors.filter(d => d.hasPanel === false);
                  const renderDoctor = (doctor: typeof filteredDoctors[0]) => (
                    <label
                      key={doctor.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDoctors.includes(doctor.id)}
                        onChange={() => toggleDoctorSelection(doctor.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-gray-900">{doctor.name}</p>
                          {isVisitedThisMonth(doctor) && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Visitado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {doctor.address.neighborhood}, {doctor.address.city} - {doctor.address.state}
                        </p>
                      </div>
                      <MapPin className="w-4 h-4 text-gray-400" />
                    </label>
                  );
                  return (
                    <>
                      {panelDocs.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-green-50 border-b border-green-100 flex items-center justify-between sticky top-0 z-10">
                            <span className="text-[11px] font-bold text-green-700 uppercase tracking-wide">
                              Com painel ({panelDocs.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = panelDocs.map(d => d.id);
                                setSelectedDoctors(prev => {
                                  const next = [...new Set([...prev, ...ids])];
                                  if (next.length > 0 && !lockedState && panelDocs[0]?.address.state) {
                                    setLockedState(panelDocs[0].address.state);
                                  }
                                  return next;
                                });
                              }}
                              className="text-[10px] text-green-600 hover:underline"
                            >
                              Selecionar todos
                            </button>
                          </div>
                          {panelDocs.map(renderDoctor)}
                        </>
                      )}
                      {suggestionDocs.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-orange-50 border-b border-orange-100 border-t border-t-gray-200 flex items-center justify-between sticky top-0 z-10">
                            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wide">
                              Sem painel — Sugestões ({suggestionDocs.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = suggestionDocs.map(d => d.id);
                                setSelectedDoctors(prev => [...new Set([...prev, ...ids])]);
                              }}
                              className="text-[10px] text-orange-600 hover:underline"
                            >
                              Selecionar todos
                            </button>
                          </div>
                          {suggestionDocs.map(renderDoctor)}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          {/* Pharmacy Selection */}
          {pharmacies.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-teal-600" />
                  Farmácias no roteiro <span className="text-gray-400 font-normal text-xs">(opcional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPharmacies(pharmacies.map(p => p.id))}
                    className="text-xs text-teal-600 hover:text-teal-700"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPharmacies([])}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {selectedPharmacies.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-gray-600">Máx. por dia:</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={pharmaciesPerDay}
                    onChange={e => setPharmaciesPerDay(Math.max(1, parseInt(e.target.value) || 1))}
                    className="input w-16 text-sm py-1"
                  />
                  <span className="text-xs text-gray-400">farmácia{pharmaciesPerDay !== 1 ? 's' : ''}/dia</span>
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {pharmacies.map(pharmacy => {
                  const displayName = pharmacy.name || pharmacy.address.neighborhood || pharmacy.address.city || 'Farmácia';
                  const subLabel = [pharmacy.address.neighborhood, pharmacy.address.city].filter(Boolean).join(', ');
                  return (
                    <label
                      key={pharmacy.id}
                      className="flex items-center p-3 hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPharmacies.includes(pharmacy.id)}
                        onChange={() => setSelectedPharmacies(prev =>
                          prev.includes(pharmacy.id)
                            ? prev.filter(id => id !== pharmacy.id)
                            : [...prev, pharmacy.id]
                        )}
                        className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                      />
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{displayName}</p>
                        {subLabel && <p className="text-xs text-gray-500">{subLabel}</p>}
                      </div>
                      <Pill className="w-4 h-4 text-teal-400 shrink-0" />
                    </label>
                  );
                })}
              </div>
              {selectedPharmacies.length > 0 && (
                <p className="text-xs text-teal-600 mt-1.5">
                  {selectedPharmacies.length} farmácia{selectedPharmacies.length !== 1 ? 's' : ''} selecionada{selectedPharmacies.length !== 1 ? 's' : ''} · até {pharmaciesPerDay}/dia (alocadas por proximidade)
                </p>
              )}
            </div>
          )}
          </div>} {/* end step 1 */}

          {/* ── Preview step (with DnD) ── */}
          {isPreview && (() => {
            const weeks: Record<string, PreviewDay[]> = {};
            for (const day of previewDays) {
              const wk = format(startOfWeek(day.date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
              if (!weeks[wk]) weeks[wk] = [];
              weeks[wk].push(day);
            }
            const weekEntries = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]));

            const handlePreviewDragStart = (e: DragStartEvent) => {
              const [, , docId, type] = (e.active.id as string).split('|');
              const day = previewDays.find(d => d.panelDoctors.some(doc => doc.id === docId) || d.suggestionDoctors.some(doc => doc.id === docId));
              if (!day) return;
              const doc = type === 'panel'
                ? day.panelDoctors.find(d => d.id === docId)
                : day.suggestionDoctors.find(d => d.id === docId);
              setActiveDragPreview(doc ? { doctorName: doc.name, isPanel: type === 'panel' } : null);
            };

            const handlePreviewDragEnd = (e: DragEndEvent) => {
              setActiveDragPreview(null);
              if (!e.over) return;
              const [, srcDate, docId, type] = (e.active.id as string).split('|');
              const targetDate = (e.over.id as string).replace('pcol|', '');
              if (srcDate === targetDate) return;

              setPreviewDays(prev => {
                const srcDay = prev.find(d => d.dateStr === srcDate);
                const tgtDay = prev.find(d => d.dateStr === targetDate);
                if (!srcDay || !tgtDay) return prev;

                let movedDoc: Doctor | undefined;
                const newSrc = { ...srcDay };
                const newTgt = { ...tgtDay };

                if (type === 'panel') {
                  movedDoc = srcDay.panelDoctors.find(d => d.id === docId);
                  if (!movedDoc) return prev;
                  newSrc.panelDoctors = srcDay.panelDoctors.filter(d => d.id !== docId);
                  // Keep doctor as panel in target (it's a panel doctor)
                  if (!newTgt.panelDoctors.some(d => d.id === docId))
                    newTgt.panelDoctors = [...tgtDay.panelDoctors, movedDoc];
                } else {
                  movedDoc = srcDay.suggestionDoctors.find(d => d.id === docId);
                  if (!movedDoc) return prev;
                  newSrc.suggestionDoctors = srcDay.suggestionDoctors.filter(d => d.id !== docId);
                  if (!newTgt.suggestionDoctors.some(d => d.id === docId))
                    newTgt.suggestionDoctors = [...tgtDay.suggestionDoctors, movedDoc];
                }

                return prev.map(d =>
                  d.dateStr === srcDate ? newSrc :
                  d.dateStr === targetDate ? newTgt : d
                );
              });
            };

            // Draggable doctor chip for preview
            const PreviewDocChip = ({ doc, dateStr, type }: { doc: Doctor; dateStr: string; type: 'panel' | 'suggestion' }) => {
              const dragId = `pdoc|${dateStr}|${doc.id}|${type}`;
              const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
              const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
              return (
                <div ref={setNodeRef} style={style} {...attributes}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 mb-0.5 select-none ${type === 'panel' ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                  <span {...listeners} className="shrink-0 text-gray-300 hover:text-gray-500 cursor-grab touch-none">
                    <GripVertical className="w-3 h-3" />
                  </span>
                  <p className={`text-[10px] truncate flex-1 ${type === 'panel' ? 'text-gray-800' : 'text-orange-700'}`}>{doc.name}</p>
                  <button type="button" onClick={() => handleRemoveDoctorFromDay(dateStr, doc.id, type)}
                    className="text-gray-300 hover:text-red-500 shrink-0 text-xs leading-none">✕</button>
                </div>
              );
            };

            // Droppable day column for preview
            const PreviewDropCol = ({ day, children }: { day: PreviewDay; children: React.ReactNode }) => {
              const { setNodeRef, isOver } = useDroppable({ id: `pcol|${day.dateStr}` });
              return (
                <div ref={setNodeRef}
                  className={`flex-shrink-0 w-32 rounded-xl border overflow-hidden transition-colors ${isOver ? 'border-blue-400 ring-1 ring-blue-300 bg-blue-50/20' : 'border-gray-200 bg-white'}`}>
                  {children}
                </div>
              );
            };

            return (
              <DndContext sensors={previewSensors} onDragStart={handlePreviewDragStart} onDragEnd={handlePreviewDragEnd}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">{previewDays.length} dias gerados</p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-green-200 border border-green-400" /><span className="text-gray-500">Com painel</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-orange-200 border border-orange-400" /><span className="text-gray-500">Sem painel</span></div>
                    </div>
                  </div>
                  {weekEntries.map(([wk, days]) => (
                    <div key={wk}>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">
                        Semana de {format(new Date(wk + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="overflow-x-auto -mx-1 px-1">
                        <div className="flex gap-2 pb-1" style={{ minWidth: `${days.length * 136}px` }}>
                          {days.map(day => (
                            <PreviewDropCol key={day.dateStr} day={day}>
                              <div className="bg-gray-50 px-2 py-1.5 text-center border-b border-gray-200">
                                <p className="text-[11px] font-bold text-gray-800 capitalize">
                                  {format(day.date, 'EEE', { locale: ptBR })} {format(day.date, 'd/MM')}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {day.panelDoctors.length > 0 && <span className="text-green-600">{day.panelDoctors.length}p</span>}
                                  {day.panelDoctors.length > 0 && day.suggestionDoctors.length > 0 && ' · '}
                                  {day.suggestionDoctors.length > 0 && <span className="text-orange-500">{day.suggestionDoctors.length}s</span>}
                                  {day.panelDoctors.length === 0 && day.suggestionDoctors.length === 0 && 'vazio'}
                                </p>
                              </div>
                              <div className="p-1.5 min-h-[40px]">
                                {day.panelDoctors.map(doc => (
                                  <PreviewDocChip key={doc.id} doc={doc} dateStr={day.dateStr} type="panel" />
                                ))}
                                {day.suggestionDoctors.length > 0 && (
                                  <div className={day.panelDoctors.length > 0 ? 'pt-1 mt-1 border-t border-orange-100' : ''}>
                                    {day.suggestionDoctors.map(doc => (
                                      <PreviewDocChip key={doc.id} doc={doc} dateStr={day.dateStr} type="suggestion" />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </PreviewDropCol>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <DragOverlay>
                  {activeDragPreview && (
                    <div className={`rounded-lg px-2 py-1.5 shadow-xl border text-[10px] font-semibold opacity-95 ${
                      activeDragPreview.isPanel ? 'bg-green-50 border-green-300 text-green-800' : 'bg-orange-50 border-orange-300 text-orange-700'
                    }`}>
                      {activeDragPreview.doctorName}
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            );
          })()}

          {/* Error message */}
          {createError && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (isPreview) { setIsPreview(false); setPreviewDays([]); return; }
                setShowNewRouteModal(false);
                setRouteName('');
                setWeeklyDistribution(null);
                setSelectedDoctors([]);
                setCreateError('');
                setNumberOfWeeks(1);
                setMultiWeekDistributions([]);

                setExcludedDates(new Set());
                setExcludedMornings(new Set());
                setExcludedAfternoons(new Set());
                setPendingExclusionDate(null);
              }}
              className="btn-secondary flex-1"
            >
              {isPreview ? '← Voltar' : 'Cancelar'}
            </button>
            {isPreview ? (
              <button
                onClick={handleConfirmRoute}
                disabled={isCreating || previewDays.every(d => d.panelDoctors.length === 0 && d.suggestionDoctors.length === 0)}
                className="btn-primary flex-1"
              >
                {isCreating ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            ) : (
              <button
                onClick={handleGeneratePreview}
                disabled={selectedDoctors.length === 0}
                className="btn-primary flex-1"
              >
                Pré-visualizar →
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Apagar Roteiro"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Tem certeza?</p>
              <p className="text-sm text-red-700 mt-1">
                O roteiro <strong>{routeToManage && formatWeekRange(routeToManage.weekStartDate, routeToManage.weekEndDate)}</strong> e todas as suas visitas programadas serão apagados permanentemente. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleDeleteRoute}
              disabled={isDeleting}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Apagando...' : 'Apagar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Duplicate / Apply Route Modal */}
      <Modal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Aplicar Roteiro"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Os mesmos médicos e a distribuição por dia de semana do roteiro atual serão copiados para a semana selecionada.
          </p>
          <div>
            <label className="label">Semana de destino</label>
            <input
              type="date"
              className="input"
              value={duplicateTargetWeek}
              onChange={e => setDuplicateTargetWeek(e.target.value)}
            />
            {duplicateTargetWeek && (
              <p className="text-xs text-gray-500 mt-1">
                {(() => {
                  const d = new Date(duplicateTargetWeek + 'T12:00:00');
                  const ws = startOfWeek(d, { weekStartsOn: 1 });
                  return formatWeekRange(ws, addDays(ws, 4));
                })()}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDuplicateModal(false)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleDuplicateRoute}
              disabled={isDuplicating || !duplicateTargetWeek}
              className="btn-primary flex-1"
            >
              {isDuplicating ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
