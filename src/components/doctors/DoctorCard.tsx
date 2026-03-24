import { MapPin, Phone, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Doctor } from '../../types';
import { formatShortAddress, formatTimeAgo } from '../../utils/format';

export function isVisitedThisMonth(doctor: Doctor): boolean {
  if (!doctor.lastVisitDate) return false;
  const now = new Date();
  const d = new Date(doctor.lastVisitDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

interface DoctorCardProps {
  doctor: Doctor;
  onClick?: () => void;
  showLastVisit?: boolean;
  onMarkVisited?: (e: React.MouseEvent) => void;
}

export function DoctorCard({ doctor, onClick, showLastVisit = true, onMarkVisited }: DoctorCardProps) {
  const visitedThisMonth = isVisitedThisMonth(doctor);

  const noPainel = doctor.hasPanel === false;

  return (
    <div
      className={`rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${
        noPainel ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
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
          </div>
          <p className="text-sm text-gray-500">
            CRM {doctor.crm}
            {doctor.specialty && ` • ${doctor.specialty}`}
          </p>
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />}
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          <span className="truncate">{formatShortAddress(doctor.address)}</span>
        </div>

        {doctor.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="w-4 h-4 mr-2 text-gray-400" />
            <span>{doctor.phone}</span>
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
