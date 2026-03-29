import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Users, History, Settings,
  MapPin, Pill, CalendarOff,
  CheckCircle2, AlertCircle, BarChart2, CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDoctors } from '../hooks/useDoctors';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { isVisitedThisMonth } from '../components/doctors/DoctorCard';
import { exportDoctorsToExcel } from '../services/excel';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { doctors } = useDoctors();
  const { settings } = useApp();
  const cycleDay = settings?.cycleStartDay ?? 1;

  const today = new Date();
  const visitedCount   = doctors.filter(d => isVisitedThisMonth(d, cycleDay)).length;
  const unvisitedCount = doctors.length - visitedCount;

  const unroutedCount = useMemo(() => {
    const now = new Date();
    return doctors.filter(d => {
      if (!d.lastRoutedDate) return true;
      const lr = new Date(d.lastRoutedDate);
      return lr.getFullYear() !== now.getFullYear() || lr.getMonth() !== now.getMonth();
    }).length;
  }, [doctors]);

  const firstName = user?.name?.split(' ')[0] || 'Olá';

  const tiles = [
    {
      label: 'Médicos',
      description: `${doctors.length} cadastrados`,
      icon: Users,
      gradient: 'from-emerald-500 to-emerald-700',
      badge: unvisitedCount > 0 ? unvisitedCount : undefined,
      badgeColor: 'bg-amber-400',
      onClick: () => navigate('/doctors'),
    },
    {
      label: 'Farmácias',
      description: 'Gerenciar farmácias',
      icon: Pill,
      gradient: 'from-teal-500 to-teal-700',
      onClick: () => navigate('/pharmacies'),
    },
    {
      label: 'Roteiro',
      description: 'Ver e gerenciar roteiros',
      icon: ClipboardList,
      gradient: 'from-blue-500 to-blue-700',
      badge: unroutedCount > 0 ? unroutedCount : undefined,
      badgeColor: 'bg-orange-400',
      onClick: () => navigate('/routes'),
    },
    {
      label: 'Agenda',
      description: 'Calendário de visitas',
      icon: CalendarDays,
      gradient: 'from-cyan-500 to-cyan-700',
      onClick: () => navigate('/agenda'),
    },
    {
      label: 'Feriados',
      description: 'Calendário nacional e estadual',
      icon: CalendarOff,
      gradient: 'from-amber-500 to-amber-700',
      onClick: () => navigate('/holidays'),
    },
    {
      label: 'Histórico',
      description: 'Visitas realizadas',
      icon: History,
      gradient: 'from-violet-500 to-violet-700',
      onClick: () => navigate('/history'),
    },
    {
      label: 'Relatório',
      description: 'Exportar para Excel',
      icon: BarChart2,
      gradient: 'from-indigo-500 to-indigo-700',
      onClick: () => exportDoctorsToExcel(doctors),
    },
    {
      label: 'Mapa',
      description: 'Ver médicos no mapa',
      icon: MapPin,
      gradient: 'from-rose-500 to-rose-700',
      onClick: () => navigate('/doctors'),
    },
    {
      label: 'Configurações',
      description: 'Perfil e preferências',
      icon: Settings,
      gradient: 'from-gray-500 to-gray-700',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-5 pt-10 pb-14 text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MedVisit</h1>
            <p className="text-blue-200 text-sm">
              {firstName !== 'Olá'
                ? <>Olá, <span className="font-medium text-white">{firstName}</span> —{' '}</>
                : 'Olá — '
              }
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Monthly progress */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-3 text-center">
            <p className="text-2xl font-bold">{doctors.length}</p>
            <p className="text-[11px] text-blue-200 mt-0.5">Médicos</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-green-300" />
              <p className="text-2xl font-bold text-green-300">{visitedCount}</p>
            </div>
            <p className="text-[11px] text-blue-200 mt-0.5">Visitados</p>
          </div>
          <div className={`backdrop-blur-sm rounded-2xl px-3 py-3 text-center ${unvisitedCount > 0 ? 'bg-amber-400/30' : 'bg-white/10'}`}>
            <div className="flex items-center justify-center gap-1">
              {unvisitedCount > 0 && <AlertCircle className="w-4 h-4 text-amber-300" />}
              <p className={`text-2xl font-bold ${unvisitedCount > 0 ? 'text-amber-300' : ''}`}>{unvisitedCount}</p>
            </div>
            <p className="text-[11px] text-blue-200 mt-0.5">Pendentes</p>
          </div>
        </div>
      </div>

      {/* ── Navigation grid ── */}
      <div className="px-4 -mt-6">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ label, description, icon: Icon, gradient, badge, badgeColor, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="relative bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md active:scale-[0.97] transition-all text-left"
            >
              {badge !== undefined && (
                <span className={`absolute top-3 right-3 min-w-[20px] h-5 px-1.5 ${badgeColor || 'bg-red-500'} text-white text-[10px] font-bold rounded-full flex items-center justify-center`}>
                  {badge}
                </span>
              )}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm mb-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{description}</p>
            </button>
          ))}
        </div>

        <p className="text-center text-[11px] text-gray-300 mt-6 mb-4">MedVisit v1.0.0</p>
      </div>
    </div>
  );
}
