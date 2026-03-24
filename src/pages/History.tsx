import { useState, useEffect } from 'react';
import { Search, Filter, Calendar, ChevronRight, FileText, Package } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useVisits } from '../hooks/useVisits';
import { Modal } from '../components/common/Modal';
import { PageLoading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';
import { formatDate, formatVisitStatus } from '../utils/format';
import type { Visit, VisitStatus } from '../types';

export function HistoryPage() {
  const { visits, isLoading, getVisitsForPeriod } = useVisits();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VisitStatus | ''>('');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | 'month' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>(visits);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Apply filters
  useEffect(() => {
    const applyFilters = async () => {
      let result = visits;

      // Apply date filter
      const today = new Date();
      let startDate: Date | null = null;
      let endDate: Date = endOfDay(today);

      switch (dateFilter) {
        case '7days':
          startDate = subDays(today, 7);
          break;
        case '30days':
          startDate = subDays(today, 30);
          break;
        case 'month':
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
          break;
        case 'custom':
          if (customStartDate) startDate = startOfDay(new Date(customStartDate));
          if (customEndDate) endDate = endOfDay(new Date(customEndDate));
          break;
      }

      if (startDate) {
        result = await getVisitsForPeriod(startDate, endDate);
      }

      // Apply status filter
      if (statusFilter) {
        result = result.filter(v => v.status === statusFilter);
      }

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(v =>
          v.doctor?.name.toLowerCase().includes(query) ||
          v.notes?.toLowerCase().includes(query) ||
          v.productsPresented?.some(p => p.toLowerCase().includes(query))
        );
      }

      setFilteredVisits(result);
    };

    applyFilters();
  }, [visits, searchQuery, statusFilter, dateFilter, customStartDate, customEndDate, getVisitsForPeriod]);

  const getStatusBadge = (status: VisitStatus) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      not_done: 'bg-red-100 text-red-700',
      rescheduled: 'bg-yellow-100 text-yellow-700'
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {formatVisitStatus(status)}
      </span>
    );
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case '7days': return 'Últimos 7 dias';
      case '30days': return 'Últimos 30 dias';
      case 'month': return 'Este mês';
      case 'custom': return 'Período personalizado';
      default: return 'Todas';
    }
  };

  // Group visits by date
  const groupedVisits = filteredVisits.reduce((groups, visit) => {
    const date = format(new Date(visit.date), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(visit);
    return groups;
  }, {} as Record<string, Visit[]>);

  const sortedDates = Object.keys(groupedVisits).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Histórico de Visitas</h1>
          <button
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
              statusFilter || dateFilter !== '30days' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtrar
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por médico ou anotação..."
            className="input pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Active Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {getDateFilterLabel()}
          </span>
          {statusFilter && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
              {formatVisitStatus(statusFilter)}
              <button
                onClick={() => setStatusFilter('')}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-gray-900">{filteredVisits.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">
              {filteredVisits.filter(v => v.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500">Realizadas</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-red-600">
              {filteredVisits.filter(v => v.status === 'not_done').length}
            </p>
            <p className="text-xs text-gray-500">Não realizadas</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-yellow-600">
              {filteredVisits.filter(v => v.status === 'rescheduled').length}
            </p>
            <p className="text-xs text-gray-500">Reagendadas</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {filteredVisits.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhuma visita encontrada"
            description={searchQuery || statusFilter ? "Tente ajustar seus filtros" : "Comece a registrar suas visitas para ver o histórico aqui."}
          />
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-500 mb-2 capitalize">
                  {format(new Date(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h3>
                <div className="space-y-2">
                  {groupedVisits[date].map(visit => (
                    <div
                      key={visit.id}
                      onClick={() => setSelectedVisit(visit)}
                      className="card flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {visit.doctor?.name || 'Médico não encontrado'}
                          </p>
                          {getStatusBadge(visit.status)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {visit.startTime}
                          {visit.endTime && ` - ${visit.endTime}`}
                          {visit.doctor?.specialty && ` • ${visit.doctor.specialty}`}
                        </p>
                        {visit.notes && (
                          <p className="text-sm text-gray-400 truncate mt-1">{visit.notes}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filtrar Histórico"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Período</label>
            <select
              className="input"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
            >
              <option value="all">Todas as datas</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
              <option value="month">Este mês</option>
              <option value="custom">Período personalizado</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Data inicial</label>
                <input
                  type="date"
                  className="input"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Data final</label>
                <input
                  type="date"
                  className="input"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as VisitStatus | '')}
            >
              <option value="">Todos</option>
              <option value="completed">Realizadas</option>
              <option value="not_done">Não realizadas</option>
              <option value="rescheduled">Reagendadas</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setDateFilter('30days');
                setStatusFilter('');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="btn-secondary flex-1"
            >
              Limpar
            </button>
            <button
              onClick={() => setShowFilterModal(false)}
              className="btn-primary flex-1"
            >
              Aplicar
            </button>
          </div>
        </div>
      </Modal>

      {/* Visit Detail Modal */}
      <Modal
        isOpen={!!selectedVisit}
        onClose={() => setSelectedVisit(null)}
        title="Detalhes da Visita"
      >
        {selectedVisit && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{selectedVisit.doctor?.name}</h3>
                {getStatusBadge(selectedVisit.status)}
              </div>
              <p className="text-sm text-gray-600">CRM {selectedVisit.doctor?.crm}</p>
              {selectedVisit.doctor?.specialty && (
                <p className="text-sm text-gray-500">{selectedVisit.doctor.specialty}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Data</p>
                <p className="text-sm font-medium">{formatDate(selectedVisit.date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Horário</p>
                <p className="text-sm font-medium">
                  {selectedVisit.startTime}
                  {selectedVisit.endTime && ` - ${selectedVisit.endTime}`}
                </p>
              </div>
            </div>

            {selectedVisit.reason && (
              <div>
                <p className="text-xs text-gray-500">Motivo</p>
                <p className="text-sm">{selectedVisit.reason}</p>
              </div>
            )}

            {selectedVisit.notes && (
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <FileText className="w-4 h-4" />
                  Anotações
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                  {selectedVisit.notes}
                </p>
              </div>
            )}

            {selectedVisit.productsPresented && selectedVisit.productsPresented.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <Package className="w-4 h-4" />
                  Produtos Apresentados
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedVisit.productsPresented.map((product, i) => (
                    <span key={i} className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedVisit.samplesDelivered && selectedVisit.samplesDelivered.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Amostras Entregues</p>
                <div className="space-y-1">
                  {selectedVisit.samplesDelivered.map((sample, i) => (
                    <div key={i} className="flex justify-between text-sm bg-gray-50 px-3 py-1 rounded">
                      <span>{sample.productName}</span>
                      <span className="text-gray-500">x{sample.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedVisit(null)}
              className="btn-secondary w-full"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
