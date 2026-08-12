import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin,
  Plus, Route, Stethoscope, UserPlus, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDoctors } from '../hooks/useDoctors';
import { useRoutes } from '../hooks/useRoutes';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { isVisitedThisMonth } from '../utils/visitCycle';
import type { ScheduledVisit, VisitStatus } from '../types';

const STATUS_STYLES: Record<VisitStatus, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Próxima', className: 'bg-blue-100 text-blue-700' },
  not_done: { label: 'Não realizada', className: 'bg-red-100 text-red-700' },
  rescheduled: { label: 'Reagendada', className: 'bg-amber-100 text-amber-700' }
};

function getVisitName(visit: ScheduledVisit) {
  return visit.doctor?.name ?? visit.pharmacy?.name ?? 'Visita sem identificação';
}

function getVisitLocation(visit: ScheduledVisit) {
  const address = visit.doctor?.address ?? visit.pharmacy?.address;
  if (!address) return 'Endereço não informado';
  return [address.street, address.number, address.neighborhood].filter(Boolean).join(', ');
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { doctors } = useDoctors();
  const { todaySchedule, isLoading: loadingSchedule } = useRoutes();
  const { settings } = useApp();
  const cycleDay = settings?.cycleStartDay ?? 1;
  const today = new Date();

  const visitedCount = doctors.filter(doctor => isVisitedThisMonth(doctor, cycleDay)).length;
  const pendingCount = Math.max(doctors.length - visitedCount, 0);
  const progress = doctors.length > 0 ? Math.round((visitedCount / doctors.length) * 100) : 0;
  const firstName = user?.name?.trim().split(' ')[0] || '';

  const todayVisits = useMemo(
    () => [...(todaySchedule?.visits ?? [])].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [todaySchedule]
  );
  const nextVisit = todayVisits.find(visit => visit.status === 'in_progress')
    ?? todayVisits.find(visit => visit.status === 'pending');

  const quickActions = [
    { label: 'Novo médico', icon: UserPlus, onClick: () => navigate('/doctors/new') },
    { label: 'Criar roteiro', icon: Route, onClick: () => navigate('/routes/new') },
    { label: 'Abrir agenda', icon: CalendarDays, onClick: () => navigate('/agenda') }
  ];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-7 lg:py-3">
      <div className="mx-auto max-w-6xl space-y-5 lg:flex lg:h-full lg:flex-col lg:gap-3 lg:space-y-0">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">{format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Bom dia{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-slate-500 lg:mt-0">Confira suas visitas e prioridades para hoje.</p>
          </div>
          <button onClick={() => navigate('/agenda')} className="btn-secondary self-start sm:self-auto">
            <CalendarDays className="mr-2 h-4 w-4" /> Ver agenda completa
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:gap-3">
          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-5 py-4 lg:py-2.5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Próxima visita</p>
                <p className="mt-0.5 text-sm text-blue-800">Seu próximo compromisso do dia</p>
              </div>
              <div className="rounded-xl bg-blue-600 p-2.5 text-white"><Stethoscope className="h-5 w-5" /></div>
            </div>
            <div className="p-5 lg:p-3.5">
              {loadingSchedule ? (
                <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
              ) : nextVisit ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{getVisitName(nextVisit)}</h2>
                      <p className="mt-1 text-sm text-slate-500">{nextVisit.doctor?.specialty ?? (nextVisit.pharmacy ? 'Farmácia' : 'Visita')}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {nextVisit.status === 'in_progress' ? 'Em andamento' : 'Próxima'}
                    </span>
                  </div>
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm text-slate-700"><Clock3 className="h-4 w-4 text-blue-500" /> {nextVisit.scheduledTime}</div>
                    <div className="flex items-start gap-2 text-sm text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> {getVisitLocation(nextVisit)}</div>
                  </div>
                  <button onClick={() => navigate('/agenda')} className="btn-primary w-full sm:w-auto">
                    Abrir visita <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center text-center lg:min-h-24">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 lg:h-7 lg:w-7" />
                  <h2 className="mt-3 font-semibold text-slate-800 lg:mt-1.5">Nenhuma visita pendente hoje</h2>
                  <p className="mt-1 text-sm text-slate-500">Você pode consultar a agenda ou preparar o próximo roteiro.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Progresso do ciclo</h2>
                <p className="mt-0.5 text-xs text-slate-500">Ciclo iniciado no dia {cycleDay}</p>
              </div>
              <span className="text-2xl font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 lg:mt-3 lg:h-2.5">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 lg:mt-3">
              <div className="rounded-xl bg-slate-50 p-3 text-center"><Users className="mx-auto h-4 w-4 text-slate-500" /><p className="mt-1 text-xl font-bold text-slate-900">{doctors.length}</p><p className="text-[11px] text-slate-500">Médicos</p></div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center"><CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /><p className="mt-1 text-xl font-bold text-emerald-700">{visitedCount}</p><p className="text-[11px] text-emerald-700">Visitados</p></div>
              <div className="rounded-xl bg-amber-50 p-3 text-center"><Clock3 className="mx-auto h-4 w-4 text-amber-600" /><p className="mt-1 text-xl font-bold text-amber-700">{pendingCount}</p><p className="text-[11px] text-amber-700">Pendentes</p></div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:p-4">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="font-semibold text-slate-900">Agenda de hoje</h2><p className="text-xs text-slate-500">{todayVisits.length} compromisso{todayVisits.length === 1 ? '' : 's'} programado{todayVisits.length === 1 ? '' : 's'}</p></div>
            <button onClick={() => navigate('/agenda')} className="text-sm font-medium text-blue-600 hover:text-blue-700">Ver completa</button>
          </div>
          {todayVisits.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {todayVisits.slice(0, 5).map(visit => {
                const status = STATUS_STYLES[visit.status];
                return (
                  <button key={visit.id} onClick={() => navigate('/agenda')} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 sm:px-2 lg:py-2">
                    <span className="w-12 shrink-0 text-sm font-semibold text-blue-600">{visit.scheduledTime}</span>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${visit.status === 'completed' ? 'bg-emerald-500' : visit.status === 'pending' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{getVisitName(visit)}</p><p className="truncate text-xs text-slate-500">{getVisitLocation(visit)}</p></div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline ${status.className}`}>{status.label}</span>
                  </button>
                );
              })}
            </div>
          ) : <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">Nenhuma visita programada para hoje.</p>}
        </section>

        <section className="lg:shrink-0">
          <h2 className="mb-3 font-semibold text-slate-900">Ações rápidas</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {quickActions.map(({ label, icon: Icon, onClick }) => (
              <button key={label} onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md lg:p-3">
                <span className="rounded-xl bg-blue-50 p-3 text-blue-600 lg:p-2"><Icon className="h-5 w-5" /></span>
                <span className="font-medium text-slate-800">{label}</span>
                <Plus className="ml-auto h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
