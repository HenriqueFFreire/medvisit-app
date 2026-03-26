import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, List, CalendarDays, CheckCircle2, XCircle, Clock, GripVertical, Circle, ClipboardList } from 'lucide-react';
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useRoutes } from '../hooks/useRoutes';
import { useAgenda } from '../hooks/useAgenda';
import { useDoctors } from '../hooks/useDoctors';
import { PageLoading } from '../components/common/Loading';
import type { DailySchedule, ScheduledVisit, VisitStatus } from '../types';

type AgendaView = 'month' | 'week' | 'day';

const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');

export function AgendaPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<AgendaView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [daySchedule, setDaySchedule] = useState<DailySchedule | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [weekSchedules, setWeekSchedules] = useState<DailySchedule[]>([]);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);

  const { getDailySchedule, routes, updateScheduledVisit, moveVisitToDay } = useRoutes();
  const { monthSchedules, loadMonth, isLoading } = useAgenda();
  const { markVisited } = useDoctors();

  useEffect(() => {
    if (view === 'month') loadMonth(currentDate);
  }, [currentDate, view, loadMonth]);

  const findRouteForDate = useCallback((date: Date) => {
    const ds = toDateStr(date);
    return routes.find(r => toDateStr(r.weekStartDate) <= ds && ds <= toDateStr(r.weekEndDate)) || null;
  }, [routes]);

  const loadWeekSchedules = useCallback(async (date: Date) => {
    setIsLoadingWeek(true);
    setWeekSchedules([]);
    try {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
      const results: DailySchedule[] = [];
      for (const day of weekDays) {
        const route = findRouteForDate(day);
        if (route) {
          const sched = await getDailySchedule(route.id, day);
          if (sched) results.push(sched);
        }
      }
      setWeekSchedules(results);
    } finally {
      setIsLoadingWeek(false);
    }
  }, [findRouteForDate, getDailySchedule]);

  useEffect(() => {
    if (view === 'week') loadWeekSchedules(currentDate);
  }, [view, currentDate, loadWeekSchedules]);

  const loadDaySchedule = useCallback(async (date: Date) => {
    setIsLoadingDay(true);
    setDaySchedule(null);
    try {
      const route = findRouteForDate(date);
      if (route) {
        const sched = await getDailySchedule(route.id, date);
        setDaySchedule(sched);
      }
    } finally {
      setIsLoadingDay(false);
    }
  }, [findRouteForDate, getDailySchedule]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setView('day');
    setCurrentDate(date);
    loadDaySchedule(date);
  };

  const handleUpdateVisit = useCallback(async (visitId: string, status: VisitStatus, doctorId?: string) => {
    await updateScheduledVisit(visitId, { status });
    if (status === 'completed' && doctorId) {
      try { await markVisited(doctorId); } catch {}
    }
  }, [updateScheduledVisit, markVisited]);

  const handleMoveVisit = useCallback(async (visitId: string, targetDateStr: string) => {
    await moveVisitToDay(visitId, targetDateStr);
    await loadWeekSchedules(currentDate);
  }, [moveVisitToDay, loadWeekSchedules, currentDate]);

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, typeof monthSchedules[0]>();
    for (const s of monthSchedules) map.set(s.date, s);
    return map;
  }, [monthSchedules]);

  const goBack = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, -1));
    else if (view === 'week') setCurrentDate(d => addDays(d, -7));
    else setCurrentDate(d => addDays(d, -1));
  };
  const goForward = () => {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1));
    else if (view === 'week') setCurrentDate(d => addDays(d, 7));
    else setCurrentDate(d => addDays(d, 1));
  };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };

  const headerLabel = view === 'month'
    ? format(currentDate, 'MMMM yyyy', { locale: ptBR })
    : view === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd/MM', { locale: ptBR })} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd/MM/yyyy', { locale: ptBR })}`
    : format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold capitalize">Agenda</h1>
          <button onClick={goToday} className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg">
            Hoje
          </button>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
          {([['month', 'Mês', Calendar], ['week', 'Semana', CalendarDays], ['day', 'Dia', List]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
          <button onClick={goBack} className="p-1 hover:bg-gray-200 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-medium text-sm text-gray-900 capitalize">{headerLabel}</span>
          <button onClick={goForward} className="p-1 hover:bg-gray-200 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {view === 'month' && (isLoading ? <PageLoading /> : (
          <MonthView currentDate={currentDate} scheduleByDate={scheduleByDate} onDayClick={handleDayClick} selectedDate={selectedDate} />
        ))}
        {view === 'week' && (isLoadingWeek ? <PageLoading /> : (
          <WeekView currentDate={currentDate} weekSchedules={weekSchedules} onDayClick={handleDayClick} onMoveVisit={handleMoveVisit} hasRouteForWeek={!!findRouteForDate(currentDate)} onGoToRoutes={() => navigate('/routes')} />
        ))}
        {view === 'day' && (
          <DayView date={currentDate} schedule={daySchedule} isLoading={isLoadingDay} onUpdateVisit={handleUpdateVisit} onReloadDay={() => loadDaySchedule(currentDate)} hasRoute={!!findRouteForDate(currentDate)} onGoToRoutes={() => navigate('/routes')} />
        )}
      </div>
    </div>
  );
}

// ── Month View ──
function MonthView({ currentDate, scheduleByDate, onDayClick, selectedDate }: {
  currentDate: Date;
  scheduleByDate: Map<string, { visitCount: number; status: string }>;
  onDayClick: (date: Date) => void;
  selectedDate: Date;
}) {
  const monthStart = startOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEnd = endOfMonth(currentDate);
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {dayNames.map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const sched = scheduleByDate.get(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const hasVisits = sched && sched.visitCount > 0;
          return (
            <button key={dateStr} onClick={() => onDayClick(day)}
              className={`relative min-h-[60px] p-1 flex flex-col items-center border-b border-r border-gray-50 transition-colors ${!isCurrentMonth ? 'opacity-25' : ''} ${today ? 'bg-blue-50' : isSelected ? 'bg-indigo-50' : isWeekend ? 'bg-gray-50/40' : 'hover:bg-gray-50'}`}>
              <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${today ? 'bg-blue-600 text-white' : isSelected ? 'bg-indigo-500 text-white' : isWeekend ? 'text-gray-400' : hasVisits ? 'text-gray-900' : 'text-gray-400'}`}>
                {format(day, 'd')}
              </span>
              {hasVisits && <span className={`mt-0.5 text-[11px] font-bold leading-none ${sched.status === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>{sched.visitCount}</span>}
              {hasVisits && <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${sched.status === 'completed' ? 'bg-green-400' : 'bg-blue-400'}`} />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-5 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400" /><span className="text-[11px] text-gray-500">Agendado</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-400" /><span className="text-[11px] text-gray-500">Concluído</span></div>
        <span className="text-[11px] text-gray-400 ml-auto">Número = total de médicos</span>
      </div>
    </div>
  );
}

// ── Draggable visit chip ──
function DraggableVisitChip({ visit }: { visit: ScheduledVisit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `visit-${visit.id}` });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };
  const isPanel = !visit.isSuggestion;

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 mb-0.5 cursor-grab active:cursor-grabbing select-none ${
        visit.status === 'completed' ? 'bg-green-100 border border-green-200' :
        visit.status === 'not_done'  ? 'bg-red-50 border border-red-200' :
        isPanel ? 'bg-white border border-gray-200' : 'bg-orange-50 border border-orange-200'
      }`}>
      <span {...listeners} className="shrink-0 text-gray-300 hover:text-gray-500 touch-none">
        <GripVertical className="w-3 h-3" />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-medium truncate leading-tight ${
          visit.status === 'completed' ? 'text-green-700 line-through' :
          visit.status === 'not_done'  ? 'text-red-500 line-through' :
          isPanel ? 'text-gray-800' : 'text-orange-700'
        }`}>
          {visit.doctor?.name ?? '—'}
        </p>
        <p className={`text-[9px] truncate leading-tight ${isPanel ? 'text-gray-400' : 'text-orange-400'}`}>
          {visit.scheduledTime}
        </p>
      </div>
      {visit.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />}
      {visit.status === 'not_done'  && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
    </div>
  );
}

// ── Droppable day column ──
function DroppableDayCol({ dateStr, children, today }: { dateStr: string; children: React.ReactNode; today: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateStr}` });
  return (
    <div ref={setNodeRef}
      className={`flex-1 rounded-2xl border overflow-hidden shadow-sm transition-colors ${
        today ? 'border-blue-400 ring-1 ring-blue-300' : isOver ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/30' : 'border-gray-200'
      }`}>
      {children}
    </div>
  );
}

// ── Week View ──
function WeekView({ currentDate, weekSchedules, onDayClick, onMoveVisit, hasRouteForWeek, onGoToRoutes }: {
  currentDate: Date;
  weekSchedules: DailySchedule[];
  onDayClick: (date: Date) => void;
  onMoveVisit: (visitId: string, targetDateStr: string) => Promise<void>;
  hasRouteForWeek: boolean;
  onGoToRoutes: () => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const [activeVisit, setActiveVisit] = useState<ScheduledVisit | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const schedByDate = useMemo(() => {
    const map = new Map<string, DailySchedule>();
    for (const s of weekSchedules) map.set(format(s.date, 'yyyy-MM-dd'), s);
    return map;
  }, [weekSchedules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const allVisitsMap = useMemo(() => {
    const map = new Map<string, ScheduledVisit>();
    for (const sched of weekSchedules)
      for (const v of sched.visits) map.set(v.id, v);
    return map;
  }, [weekSchedules]);

  const handleDragStart = (e: DragStartEvent) => {
    const visitId = (e.active.id as string).replace('visit-', '');
    setActiveVisit(allVisitsMap.get(visitId) ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveVisit(null);
    if (!e.over) return;
    const visitId = (e.active.id as string).replace('visit-', '');
    const targetDateStr = (e.over.id as string).replace('day-', '');
    // Check it's actually changing day
    const visit = allVisitsMap.get(visitId);
    if (!visit) return;
    const currentSched = weekSchedules.find(s => s.visits.some(v => v.id === visitId));
    const currentDateStr = currentSched ? format(currentSched.date, 'yyyy-MM-dd') : '';
    if (targetDateStr === currentDateStr) return;
    setMovingId(visitId);
    try {
      await onMoveVisit(visitId, targetDateStr);
    } finally {
      setMovingId(null);
    }
  };

  const totalWeekVisits = weekSchedules.reduce((sum, s) => sum + s.visits.length, 0);

  if (!hasRouteForWeek) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-gray-600">Nenhum roteiro para esta semana</p>
        <p className="text-xs mt-1 mb-4">Crie um roteiro para ver as visitas aqui</p>
        <button onClick={onGoToRoutes} className="btn-primary text-sm">Ir para Roteiros</button>
      </div>
    );
  }

  if (totalWeekVisits === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Sem visitas nesta semana</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-2" style={{ minWidth: `${weekDays.length * 160}px` }}>
          {weekDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const sched = schedByDate.get(dateStr);
            const today = isToday(day);
            const panelVisits  = (sched?.visits ?? []).filter(v => !v.isSuggestion);
            const suggVisits   = (sched?.visits ?? []).filter(v => v.isSuggestion);
            const morning   = panelVisits.filter(v => parseInt(v.scheduledTime.split(':')[0]) < 12);
            const afternoon = panelVisits.filter(v => parseInt(v.scheduledTime.split(':')[0]) >= 12);

            return (
              <DroppableDayCol key={dateStr} dateStr={dateStr} today={today}>
                {/* Day header */}
                <button onClick={() => onDayClick(day)}
                  className={`w-full px-2 py-2 text-center transition-colors ${today ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}>
                  <p className={`text-[11px] font-bold capitalize ${today ? 'text-white' : 'text-gray-800'}`}>
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p className={`text-[10px] ${today ? 'text-blue-200' : 'text-gray-400'}`}>{format(day, 'd/MM')}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${today ? 'text-blue-100' : 'text-gray-500'}`}>
                    {panelVisits.length > 0 ? `${panelVisits.length} méd.${suggVisits.length > 0 ? ` +${suggVisits.length}` : ''}` : 'Sem visitas'}
                  </p>
                </button>

                {/* Visits */}
                <div className="p-1.5 bg-white min-h-[80px]">
                  {morning.length > 0 && (
                    <div className="mb-1.5">
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-[8px] font-bold text-amber-600 uppercase">Manhã</span>
                      </div>
                      {morning.map(v => (
                        movingId === v.id
                          ? <div key={v.id} className="text-[10px] text-gray-300 pl-2 py-0.5 animate-pulse">movendo...</div>
                          : <DraggableVisitChip key={v.id} visit={v} />
                      ))}
                    </div>
                  )}
                  {afternoon.length > 0 && (
                    <div className="mb-1.5">
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-[8px] font-bold text-blue-600 uppercase">Tarde</span>
                      </div>
                      {afternoon.map(v => (
                        movingId === v.id
                          ? <div key={v.id} className="text-[10px] text-gray-300 pl-2 py-0.5 animate-pulse">movendo...</div>
                          : <DraggableVisitChip key={v.id} visit={v} />
                      ))}
                    </div>
                  )}
                  {suggVisits.length > 0 && (
                    <div className="pt-1 border-t border-orange-100">
                      <div className="flex items-center gap-0.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-300 shrink-0" />
                        <span className="text-[8px] font-bold text-orange-500 uppercase">Sugestão</span>
                      </div>
                      {suggVisits.map(v => (
                        movingId === v.id
                          ? <div key={v.id} className="text-[10px] text-orange-300 pl-2 py-0.5 animate-pulse">movendo...</div>
                          : <DraggableVisitChip key={v.id} visit={v} />
                      ))}
                    </div>
                  )}
                  {panelVisits.length === 0 && suggVisits.length === 0 && (
                    <p className="text-[10px] text-gray-200 text-center py-3">— drop aqui —</p>
                  )}
                </div>
              </DroppableDayCol>
            );
          })}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeVisit && (
          <div className={`rounded-lg px-2 py-1.5 shadow-xl border text-[10px] font-semibold opacity-90 ${
            activeVisit.isSuggestion ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-blue-300 text-blue-700'
          }`}>
            {activeVisit.doctor?.name ?? '—'} · {activeVisit.scheduledTime}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Day View ──
function DayView({ date, schedule, isLoading, onUpdateVisit, onReloadDay, hasRoute, onGoToRoutes }: {
  date: Date;
  schedule: DailySchedule | null;
  isLoading: boolean;
  onUpdateVisit: (visitId: string, status: VisitStatus, doctorId?: string) => Promise<void>;
  onReloadDay: () => void;
  hasRoute: boolean;
  onGoToRoutes: () => void;
}) {
  const [visitStatuses, setVisitStatuses] = useState<Record<string, VisitStatus>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => { setVisitStatuses({}); }, [schedule?.id]);

  const getStatus = (visitId: string, baseStatus: VisitStatus): VisitStatus =>
    visitStatuses[visitId] ?? baseStatus;

  const handleSet = async (visitId: string, nextStatus: VisitStatus, doctorId?: string) => {
    setVisitStatuses(prev => ({ ...prev, [visitId]: nextStatus }));
    setTogglingId(visitId);
    try { await onUpdateVisit(visitId, nextStatus, doctorId); }
    finally { setTogglingId(null); }
  };

  const handleMarkAll = async () => {
    if (!schedule) return;
    const pending = schedule.visits.filter(v => getStatus(v.id, v.status) === 'pending');
    if (pending.length === 0) return;
    setMarkingAll(true);
    try {
      for (const v of pending) {
        setVisitStatuses(prev => ({ ...prev, [v.id]: 'completed' }));
        await onUpdateVisit(v.id, 'completed', v.doctorId);
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!hasRoute) return (
    <div className="text-center py-12">
      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="font-medium text-gray-600">Nenhum roteiro para este período</p>
      <p className="text-sm text-gray-400 mt-1 mb-4">Crie um roteiro para ver e marcar visitas</p>
      <button onClick={onGoToRoutes} className="btn-primary text-sm">Ir para Roteiros</button>
    </div>
  );

  if (!schedule || schedule.visits.length === 0) return (
    <div className="text-center py-12">
      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="font-medium text-gray-600">Sem visitas neste dia</p>
      <p className="text-sm text-gray-400 mt-1">{format(date, "d 'de' MMMM", { locale: ptBR })}</p>
    </div>
  );

  const allVisits = schedule.visits;
  const morning   = allVisits.filter(v => parseInt(v.scheduledTime.split(':')[0]) < 12);
  const afternoon = allVisits.filter(v => parseInt(v.scheduledTime.split(':')[0]) >= 12);
  const completedCount = allVisits.filter(v => getStatus(v.id, v.status) === 'completed').length;
  const notDoneCount   = allVisits.filter(v => getStatus(v.id, v.status) === 'not_done').length;
  const pendingCount   = allVisits.filter(v => getStatus(v.id, v.status) === 'pending').length;

  const renderVisit = (v: ScheduledVisit, shiftColor: 'amber' | 'blue' | 'orange') => {
    const status = getStatus(v.id, v.status);
    const isToggling = togglingId === v.id;
    const isVisited = status === 'completed';
    const isNotDone = status === 'not_done';

    return (
      <div key={v.id} className={`card py-3 flex items-center gap-3 transition-all ${
        isVisited  ? 'bg-green-50 border-green-200' :
        isNotDone  ? 'bg-red-50 border-red-200' :
        v.isSuggestion ? 'bg-orange-50 border-orange-100' : 'bg-white'
      }`}>
        {/* Checkbox: toggle visited */}
        <button
          onClick={() => handleSet(v.id, isVisited ? 'pending' : 'completed', v.doctorId)}
          disabled={isToggling || markingAll}
          className="shrink-0 p-0.5"
          title={isVisited ? 'Desmarcar visita' : 'Marcar como visitado'}
        >
          {isToggling ? (
            <div className="w-7 h-7 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
            </div>
          ) : isVisited ? (
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          ) : isNotDone ? (
            <XCircle className="w-7 h-7 text-red-400" />
          ) : (
            <Circle className={`w-7 h-7 ${shiftColor === 'amber' ? 'text-amber-300' : shiftColor === 'orange' ? 'text-orange-300' : 'text-blue-300'}`} />
          )}
        </button>

        {/* Doctor info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold shrink-0 ${
              shiftColor === 'amber' ? 'text-amber-600' :
              shiftColor === 'orange' ? 'text-orange-500' : 'text-blue-600'
            }`}>{v.scheduledTime}</span>
            <p className={`font-medium truncate ${
              isVisited  ? 'text-green-700 line-through' :
              isNotDone  ? 'text-red-600 line-through' :
              v.isSuggestion ? 'text-orange-700' : 'text-gray-900'
            }`}>
              {v.doctor?.name || v.pharmacy?.name || '—'}
            </p>
            {v.isSuggestion && (
              <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">Sugestão</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {v.doctor
              ? `${v.doctor.address.neighborhood}, ${v.doctor.address.city}`
              : v.pharmacy
              ? `${v.pharmacy.address.neighborhood}, ${v.pharmacy.address.city}`
              : ''}
          </p>
        </div>

        {/* "Não realizado" toggle */}
        <button
          onClick={() => handleSet(v.id, isNotDone ? 'pending' : 'not_done', v.doctorId)}
          disabled={isToggling || markingAll}
          title={isNotDone ? 'Desmarcar "não realizada"' : 'Marcar como não realizada'}
          className={`shrink-0 p-1.5 rounded-lg transition-colors ${
            isNotDone ? 'bg-red-100' : 'hover:bg-gray-100'
          }`}
        >
          <XCircle className={`w-5 h-5 ${isNotDone ? 'text-red-500' : 'text-gray-300'}`} />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="card">
        <p className="font-semibold text-gray-900 capitalize mb-2">
          {dayNames[date.getDay()]}, {format(date, "d 'de' MMMM", { locale: ptBR })}
        </p>
        <div className="flex gap-4 text-sm mb-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-green-700">{completedCount}</span>
            <span className="text-gray-500 text-xs">visitadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="font-semibold text-red-600">{notDoneCount}</span>
            <span className="text-gray-500 text-xs">não realizadas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-700">{pendingCount}</span>
            <span className="text-gray-500 text-xs">pendentes</span>
          </div>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-60"
          >
            {markingAll
              ? <><div className="w-4 h-4 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />Marcando...</>
              : <><CheckCircle2 className="w-4 h-4" />Marcar todos como visitados ({pendingCount})</>
            }
          </button>
        )}
      </div>

      {morning.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Manhã · {morning.length}</span>
          </div>
          <div className="space-y-2">{morning.map(v => renderVisit(v, v.isSuggestion ? 'orange' : 'amber'))}</div>
        </div>
      )}
      {afternoon.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Tarde · {afternoon.length}</span>
          </div>
          <div className="space-y-2">{afternoon.map(v => renderVisit(v, v.isSuggestion ? 'orange' : 'blue'))}</div>
        </div>
      )}
    </div>
  );
}
