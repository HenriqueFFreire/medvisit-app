import { format, formatDistance as formatDistanceDateFns, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Address } from '../types';

// Date formatting
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatDateRelative(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;

  if (isToday(d)) return 'Hoje';
  if (isTomorrow(d)) return 'Amanhã';
  if (isYesterday(d)) return 'Ontem';

  return format(d, "EEEE, dd/MM", { locale: ptBR });
}

export function formatDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatWeekRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'dd/MM', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceDateFns(d, new Date(), { addSuffix: true, locale: ptBR });
}

// Time formatting
export function formatTime(time: string): string {
  return time; // Already in HH:mm format
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

// Distance formatting
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

// Address formatting
export function formatFullAddress(address: Address): string {
  const parts = [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city} - ${address.state}`,
    address.zipCode
  ].filter(Boolean);

  return parts.join(', ');
}

export function formatShortAddress(address: Address): string {
  return `${address.neighborhood}, ${address.city}`;
}

// Number formatting
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Status formatting
export function formatVisitStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em andamento',
    completed: 'Realizada',
    not_done: 'Não realizada',
    rescheduled: 'Reagendada'
  };
  return statusMap[status] || status;
}

export function formatRouteStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Rascunho',
    confirmed: 'Confirmado',
    in_progress: 'Em andamento',
    completed: 'Concluído'
  };
  return statusMap[status] || status;
}

export function formatSyncStatus(status: string): string {
  const statusMap: Record<string, string> = {
    synced: 'Sincronizado',
    pending: 'Pendente',
    conflict: 'Conflito'
  };
  return statusMap[status] || status;
}
