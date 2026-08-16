import { MapPin, Phone, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Doctor } from '../../types';
import { formatShortAddress, formatTimeAgo } from '../../utils/format';
import { useApp } from '../../contexts/AppContext';
import { getDoctorPrimaryAddress } from '../../utils/doctorAddressUtils';
import { isVisitedThisMonth } from '../../utils/visitCycle';

const DAY_LABELS: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

interface DoctorCardProps {
  doctor: Doctor;
  onClick?: () => void;
  showLastVisit?: boolean;
  onMarkVisited?: (e: React.MouseEvent) => void;
}

export function DoctorCard({ doctor, onClick, showLastVisit = true, onMarkVisited }: DoctorCardProps) {
  const { settings } = useApp();
  const visitedThisMonth = isVisitedThisMonth(doctor, settings?.cycleStartDay ?? 1);

  const noPainel = doctor.hasPanel === false;
  const attendanceHours = doctor.workingHours.filter(hours => hours.period != null);
  const attendanceGroups = [
    { key: 'M', label: 'Manhã', items: attendanceHours.filter(hours => hours.period === 'M') },
    { key: 'T', label: 'Tarde', items: attendanceHours.filter(hours => hours.period === 'T') },
    { key: 'MT', label: 'Dia inteiro', items: attendanceHours.filter(hours => hours.period === 'MT') },
    { key: 'AG', label: 'Agendado', items: attendanceHours.filter(hours => hours.period === 'AG') },
  ].filter(group => group.items.length > 0);

  return (
    <div
      className={`relative rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${
        noPainel ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between md:pr-[40%]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{doctor.name}</h3>
            {noPainel && (
              <span className="shrink-0 text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-300 px-1.5 py-0.5 rounded-full">
                Sem painel
              </span>
            )}
            {visitedThisMonth && (
              <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Visitado
              </span>
            )}
            {doctor.category && (
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${doctor.category === 'A' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : doctor.category === 'C' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                Categoria {doctor.category}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            CRM {doctor.crm}
            {doctor.specialty && ` • ${doctor.specialty}`}
            {doctor.category && ` • Categoria ${doctor.category}`}
          </p>
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />}
      </div>

      <div className="mt-3 space-y-1.5 md:pr-[40%]">
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          <span className="truncate">{formatShortAddress(getDoctorPrimaryAddress(doctor))}</span>
        </div>

        {doctor.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="w-4 h-4 mr-2 text-gray-400" />
            <span>{doctor.phone}</span>
          </div>
        )}

        {attendanceGroups.length > 0 && (
          <div className="flex items-start text-sm text-gray-600 md:absolute md:right-10 md:top-4 md:w-[36%]">
            <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-100 px-2.5 py-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-[11px] font-semibold text-gray-700">Horários de atendimento</span>
              </div>
              {attendanceGroups.map((group, groupIndex) => {
                const days = group.items
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                  .map(hours => group.key === 'AG' && hours.specificTime
                    ? `${DAY_LABELS[hours.dayOfWeek]} ${hours.specificTime}`
                    : DAY_LABELS[hours.dayOfWeek])
                  .join(', ');
                return (
                  <div key={group.key} className={`grid grid-cols-[76px_1fr] gap-2 px-2.5 py-1.5 text-[11px] ${groupIndex > 0 ? 'border-t border-gray-200' : ''}`}>
                    <span className="font-semibold text-blue-700">{group.label}</span>
                    <span className="text-gray-600">{days}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showLastVisit && doctor.lastVisitDate && (
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            <span>Última visita: {formatTimeAgo(doctor.lastVisitDate)}</span>
          </div>
        )}
      </div>

      {onMarkVisited && (
        <button
          onClick={onMarkVisited}
          className={`mt-3 w-full text-xs rounded-lg py-1.5 font-medium border transition-colors ${
            visitedThisMonth
              ? 'text-gray-600 bg-gray-50 hover:bg-red-50 hover:text-red-600 border-gray-200 hover:border-red-200'
              : 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'
          }`}
        >
          {visitedThisMonth ? 'Desmarcar visita' : 'Confirmar visita este mês'}
        </button>
      )}
    </div>
  );
}
