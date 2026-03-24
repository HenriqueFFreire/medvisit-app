import { Clock, MapPin, Navigation, CheckCircle, XCircle, PlayCircle, CheckCircle2 } from 'lucide-react';
import type { ScheduledVisit } from '../../types';
import { formatShortAddress, formatDistanceKm, formatDuration } from '../../utils/format';
import { getGoogleMapsUrl, getWazeUrl } from '../../services/routing';

interface VisitCardProps {
  visit: ScheduledVisit;
  isNext?: boolean;
  period?: 'morning' | 'afternoon';
  visitedThisMonth?: boolean;
  onMarkVisited?: () => void;
  onStartVisit?: () => void;
  onCompleteVisit?: () => void;
  onCancelVisit?: () => void;
  onNavigate?: (app: 'google' | 'waze') => void;
}

export function VisitCard({
  visit,
  isNext = false,
  period,
  visitedThisMonth = false,
  onMarkVisited,
  onStartVisit,
  onCompleteVisit,
  onCancelVisit,
  onNavigate
}: VisitCardProps) {
  const doctor = visit.doctor;

  const statusColors = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-600',
    completed: 'bg-green-100 text-green-600',
    not_done: 'bg-red-100 text-red-600',
    rescheduled: 'bg-yellow-100 text-yellow-600'
  };

  const statusLabels = {
    pending: 'Pendente',
    in_progress: 'Em andamento',
    completed: 'Realizada',
    not_done: 'Não realizada',
    rescheduled: 'Reagendada'
  };

  const handleNavigate = (app: 'google' | 'waze') => {
    if (!doctor?.coordinates) return;

    const url = app === 'google'
      ? getGoogleMapsUrl(doctor.coordinates)
      : getWazeUrl(doctor.coordinates);

    window.open(url, '_blank');
    onNavigate?.(app);
  };

  const periodBorder = period === 'morning' ? 'border-amber-200' : period === 'afternoon' ? 'border-blue-200' : 'border-gray-100';
  const headerBg = isNext
    ? 'bg-blue-50'
    : period === 'morning'
    ? 'bg-amber-50'
    : period === 'afternoon'
    ? 'bg-blue-50'
    : 'bg-gray-50';

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${isNext ? 'border-blue-300 ring-2 ring-blue-100' : periodBorder} overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${isNext ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
            {visit.order}
          </span>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-1" />
            {visit.scheduledTime} - {visit.estimatedEndTime}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[visit.status]}`}>
          {statusLabels[visit.status]}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{doctor?.name || 'Médico não encontrado'}</h3>
            <p className="text-sm text-gray-500">
              CRM {doctor?.crm}
              {doctor?.specialty && ` • ${doctor.specialty}`}
            </p>
          </div>
          {/* Visited flag */}
          {onMarkVisited && (
            <button
              onClick={onMarkVisited}
              title={visitedThisMonth ? 'Visitado este mês' : 'Confirmar visita este mês'}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                visitedThisMonth
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-600'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {visitedThisMonth ? 'Visitado' : 'Visitar'}
            </button>
          )}
        </div>

        {doctor?.address && (
          <div className="flex items-start mt-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
            <span>{formatShortAddress(doctor.address)}</span>
          </div>
        )}

        {(visit.estimatedTravelTime || visit.estimatedDistance) && (
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            {visit.estimatedDistance && (
              <span>{formatDistanceKm(visit.estimatedDistance)}</span>
            )}
            {visit.estimatedTravelTime && (
              <span>~{formatDuration(visit.estimatedTravelTime)} de deslocamento</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {visit.status === 'pending' && doctor?.coordinates && (
            <>
              <button
                onClick={() => handleNavigate('google')}
                className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1"
              >
                <Navigation className="w-4 h-4" />
                Maps
              </button>
              <button
                onClick={() => handleNavigate('waze')}
                className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1"
              >
                <Navigation className="w-4 h-4" />
                Waze
              </button>
            </>
          )}

          {visit.status === 'pending' && onStartVisit && (
            <button
              onClick={onStartVisit}
              className="flex-1 btn-primary text-sm py-2 flex items-center justify-center gap-1"
            >
              <PlayCircle className="w-4 h-4" />
              Iniciar
            </button>
          )}

          {visit.status === 'in_progress' && (
            <>
              <button
                onClick={onCompleteVisit}
                className="flex-1 btn-success text-sm py-2 flex items-center justify-center gap-1"
              >
                <CheckCircle className="w-4 h-4" />
                Concluir
              </button>
              <button
                onClick={onCancelVisit}
                className="flex-1 btn-danger text-sm py-2 flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                Não realizada
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
