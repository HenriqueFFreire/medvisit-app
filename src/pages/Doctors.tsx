import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Plus, Upload, Download, Map, List, Filter, ArrowLeft, Trash2, Edit, MapPin, Phone, Mail, Clock, FileText, Users, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useDoctors } from '../hooks/useDoctors';
import { useVisits } from '../hooks/useVisits';
import { DoctorCard, isVisitedThisMonth } from '../components/doctors/DoctorCard';
import { DoctorForm, type DoctorFormData } from '../components/doctors/DoctorForm';
import { DoctorMap } from '../components/maps/DoctorMap';
import { Modal } from '../components/common/Modal';
import { PageLoading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';
import { MEDICAL_SPECIALTIES, DAYS_OF_WEEK, PERIOD_TIMES, type Doctor } from '../types';
import { formatFullAddress, formatDate, formatVisitStatus } from '../utils/format';
import { downloadDoctorTemplate, parseExcelFile, exportDoctorsToExcel } from '../services/excel';

export function DoctorsPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const {
    doctors,
    isLoading,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctor,
    refreshDoctors,
    markVisited
  } = useDoctors();

  const { getVisitsForDoctor } = useVisits();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [filterDay, setFilterDay] = useState<number>(0); // 0 = all, 1-5 = weekday
  const [filterCity, setFilterCity] = useState('');
  const [filterNeighborhood, setFilterNeighborhood] = useState('');
  const [filterComplement, setFilterComplement] = useState('');
  const [onlyUnvisited, setOnlyUnvisited] = useState(false);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>(doctors);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorVisits, setDoctorVisits] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: { row: number; message: string }[] } | null>(null);

  // Load selected doctor if ID in URL, or open new form if id === 'new'
  useEffect(() => {
    if (id === 'new') {
      setShowForm(true);
      setSelectedDoctor(null);
    } else if (id) {
      getDoctor(id).then(doctor => {
        if (doctor) {
          setSelectedDoctor(doctor);
          getVisitsForDoctor(id).then(setDoctorVisits);
        }
      });
    } else {
      setSelectedDoctor(null);
    }
  }, [id, getDoctor, getVisitsForDoctor]);

  const availableCities = useMemo(() =>
    [...new Set(doctors.map(d => d.address.city).filter(Boolean))].sort(),
    [doctors]
  );

  const availableNeighborhoods = useMemo(() =>
    [...new Set(doctors.map(d => d.address.neighborhood).filter(Boolean))].sort(),
    [doctors]
  );

  const availableComplements = useMemo(() =>
    [...new Set(doctors.map(d => d.address.complement).filter(Boolean) as string[])].sort(),
    [doctors]
  );

  // Filter doctors
  useEffect(() => {
    let result = doctors;

    if (searchQuery) {
      result = result.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.crm.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (specialtyFilter) {
      result = result.filter(d => d.specialty === specialtyFilter);
    }

    if (filterDay) {
      result = result.filter(d =>
        d.workingHours.some(wh => wh.dayOfWeek === filterDay && wh.period != null)
      );
    }

    if (filterCity) {
      result = result.filter(d => d.address.city === filterCity);
    }

    if (filterNeighborhood) {
      result = result.filter(d => d.address.neighborhood === filterNeighborhood);
    }

    if (filterComplement) {
      result = result.filter(d => d.address.complement === filterComplement);
    }

    if (onlyUnvisited) {
      result = result.filter(d => !isVisitedThisMonth(d));
    }

    setFilteredDoctors(result);
  }, [doctors, searchQuery, specialtyFilter, filterDay, filterCity, filterNeighborhood, filterComplement, onlyUnvisited]);

  const handleAddDoctor = async (data: DoctorFormData) => {
    setIsSubmitting(true);
    try {
      await addDoctor(data);
      setShowForm(false);
      if (id === 'new') navigate('/doctors');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDoctor = async (data: DoctorFormData) => {
    if (!selectedDoctor) return;

    setIsSubmitting(true);
    try {
      await updateDoctor(selectedDoctor.id, data);
      const updated = await getDoctor(selectedDoctor.id);
      setSelectedDoctor(updated || null);
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDoctor = async () => {
    if (!selectedDoctor) return;
    setIsDeleting(true);
    try {
      await deleteDoctor(selectedDoctor.id);
      setShowDeleteConfirm(false);
      navigate('/doctors');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await parseExcelFile(file);

      // Add each doctor
      let successCount = 0;
      for (const doctorData of result.doctors) {
        try {
          await addDoctor(doctorData);
          successCount++;
        } catch (err) {
          result.errors.push({ row: 0, message: `Erro ao salvar ${doctorData.name}: ${err}` });
        }
      }

      setImportResult({ success: successCount, errors: result.errors });
      await refreshDoctors();
    } catch (err) {
      setImportResult({ success: 0, errors: [{ row: 0, message: `Erro ao processar arquivo: ${err}` }] });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    exportDoctorsToExcel(doctors);
  };

  const handleDownloadTemplate = () => {
    downloadDoctorTemplate();
  };

  if (isLoading) {
    return <PageLoading />;
  }

  // Doctor Detail View
  if (selectedDoctor && !showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/doctors')}
            className="flex items-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>
          <div className="flex gap-2">
            {!isVisitedThisMonth(selectedDoctor) && (
              <button
                onClick={() => markVisited(selectedDoctor.id).then(() =>
                  getDoctor(selectedDoctor.id).then(d => d && setSelectedDoctor(d))
                )}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg"
                title="Confirmar visita este mês"
              >
                <CheckCircle2 className="w-4 h-4" />
                Visitado
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900">{selectedDoctor.name}</h2>
            <p className="text-gray-600">
              CRM {selectedDoctor.crm}
              {selectedDoctor.specialty && ` • ${selectedDoctor.specialty}`}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{formatFullAddress(selectedDoctor.address)}</span>
              </div>

              {selectedDoctor.phone && (
                <div className="flex items-center">
                  <Phone className="w-5 h-5 mr-3 text-gray-400" />
                  <a href={`tel:${selectedDoctor.phone}`} className="text-blue-600">
                    {selectedDoctor.phone}
                  </a>
                </div>
              )}

              {selectedDoctor.email && (
                <div className="flex items-center">
                  <Mail className="w-5 h-5 mr-3 text-gray-400" />
                  <a href={`mailto:${selectedDoctor.email}`} className="text-blue-600">
                    {selectedDoctor.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Working Hours */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-gray-400" />
              Horários de Atendimento
            </h3>
            <div className="space-y-2">
              {selectedDoctor.workingHours
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                .map((wh, i) => {
                  // Format period display
                  let periodDisplay = '';
                  if (wh.period) {
                    if (wh.period === 'AG' && wh.specificTime) {
                      periodDisplay = `Agendado: ${wh.specificTime}`;
                    } else {
                      periodDisplay = PERIOD_TIMES[wh.period].label;
                    }
                  } else if (wh.startTime && wh.endTime) {
                    periodDisplay = `${wh.startTime} - ${wh.endTime}`;
                  }
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 w-28 shrink-0">
                        {DAYS_OF_WEEK.find(d => d.value === wh.dayOfWeek)?.label}
                      </span>
                      {periodDisplay ? (
                        <span className="text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">
                          {periodDisplay}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Map */}
          {selectedDoctor.coordinates && (
            <div className="card p-0 overflow-hidden">
              <DoctorMap
                doctors={[selectedDoctor]}
                height="200px"
              />
            </div>
          )}

          {/* Notes */}
          {selectedDoctor.notes && (
            <div className="card">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-gray-400" />
                Observações
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{selectedDoctor.notes}</p>
            </div>
          )}

          {/* Visit History */}
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-3">Histórico de Visitas</h3>
            {doctorVisits.length > 0 ? (
              <div className="space-y-3">
                {doctorVisits.slice(0, 5).map(visit => (
                  <div key={visit.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(visit.date)}</p>
                      <p className="text-xs text-gray-500">{visit.startTime}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      visit.status === 'completed' ? 'bg-green-100 text-green-700' :
                      visit.status === 'not_done' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {formatVisitStatus(visit.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nenhuma visita registrada</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Doctor Form View
  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
          <button
            onClick={() => { setShowForm(false); if (id === 'new') navigate('/doctors'); }}
            className="flex items-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>
          <h1 className="ml-4 text-lg font-semibold">
            {selectedDoctor ? 'Editar Médico' : 'Novo Médico'}
          </h1>
        </div>

        <div className="p-4">
          <div className="card">
            <DoctorForm
              doctor={selectedDoctor || undefined}
              doctors={doctors}
              onSubmit={selectedDoctor ? handleUpdateDoctor : handleAddDoctor}
              onCancel={() => { setShowForm(false); if (id === 'new') navigate('/doctors'); }}
              isLoading={isSubmitting}
            />
          </div>
        </div>
      </div>
    );
  }

  // Doctor List View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Médicos</h1>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              title="Baixar modelo Excel para preencher"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            {doctors.length > 0 && (
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Exportar médicos cadastrados"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowImportModal(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              title="Importar médicos de planilha"
            >
              <Upload className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setSelectedDoctor(null);
                setShowForm(true);
              }}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar médico..."
            className="input pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* View Toggle & Filter */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOnlyUnvisited(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                onlyUnvisited ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
              }`}
              title="Mostrar apenas não visitados este mês"
            >
              <CheckCircle2 className="w-4 h-4" />
              {onlyUnvisited ? 'Não visitados' : 'Todos'}
            </button>
            <button
              onClick={() => setShowFilterModal(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                specialtyFilter || filterDay || filterCity || filterNeighborhood || filterComplement ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtrar
              {(specialtyFilter || filterDay || filterCity || filterNeighborhood || filterComplement) && (
                <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {[specialtyFilter, filterDay, filterCity, filterNeighborhood, filterComplement].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {filteredDoctors.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery || specialtyFilter ? "Nenhum médico encontrado" : "Nenhum médico cadastrado"}
            description={searchQuery || specialtyFilter ? "Tente ajustar sua busca ou filtros" : "Cadastre seu primeiro médico para começar"}
            action={
              !searchQuery && !specialtyFilter && (
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Médico
                </button>
              )
            }
          />
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredDoctors.map(doctor => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                onClick={() => navigate(`/doctors/${doctor.id}`)}
                onMarkVisited={async (e) => { e.stopPropagation(); await markVisited(doctor.id); }}
              />
            ))}
          </div>
        ) : (
          <DoctorMap
            doctors={filteredDoctors}
            height="calc(100vh - 250px)"
            onDoctorClick={doctor => navigate(`/doctors/${doctor.id}`)}
          />
        )}
      </div>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filtrar Médicos"
      >
        <div className="space-y-4">
          {/* Specialty */}
          <div>
            <label className="label">Especialidade</label>
            <select
              className="input"
              value={specialtyFilter}
              onChange={e => setSpecialtyFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {MEDICAL_SPECIALTIES.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>

          {/* Day of attendance */}
          <div>
            <label className="label">Dia de atendimento</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 0, label: 'Todos' },
                { value: 1, label: 'Seg' },
                { value: 2, label: 'Ter' },
                { value: 3, label: 'Qua' },
                { value: 4, label: 'Qui' },
                { value: 5, label: 'Sex' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterDay(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filterDay === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div>
            <label className="label">Cidade</label>
            <select
              className="input"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            >
              <option value="">Todas as cidades</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Neighborhood */}
          {availableNeighborhoods.length > 0 && (
            <div>
              <label className="label">Bairro</label>
              <select
                className="input"
                value={filterNeighborhood}
                onChange={e => setFilterNeighborhood(e.target.value)}
              >
                <option value="">Todos os bairros</option>
                {availableNeighborhoods.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* Complement */}
          {availableComplements.length > 0 && (
            <div>
              <label className="label">Complemento</label>
              <select
                className="input"
                value={filterComplement}
                onChange={e => setFilterComplement(e.target.value)}
              >
                <option value="">Todos os complementos</option>
                {availableComplements.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setSpecialtyFilter('');
                setFilterDay(0);
                setFilterCity('');
                setFilterNeighborhood('');
                setFilterComplement('');
                setShowFilterModal(false);
              }}
              className="btn-secondary flex-1"
            >
              Limpar tudo
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

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportResult(null);
        }}
        title="Importar Médicos"
      >
        <div className="space-y-4">
          {!importResult ? (
            <>
              <p className="text-sm text-gray-600">
                Importe médicos a partir de uma planilha Excel (.xlsx). Baixe o modelo abaixo para preencher os dados corretamente.
              </p>

              <button
                onClick={handleDownloadTemplate}
                className="btn-secondary w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Modelo Excel
              </button>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Selecione a planilha preenchida:
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                />
                {isImporting && (
                  <p className="text-sm text-blue-600 mt-2">Importando...</p>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Dica:</strong> A planilha modelo contém instruções detalhadas na segunda aba e exemplos de preenchimento.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className={`p-4 rounded-lg ${importResult.success > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`font-medium ${importResult.success > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {importResult.success} médico(s) importado(s) com sucesso
                </p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                  <p className="font-medium text-red-700 mb-2">Erros encontrados:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {importResult.errors.slice(0, 10).map((error, i) => (
                      <li key={i}>
                        {error.row > 0 ? `Linha ${error.row}: ` : ''}{error.message}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li className="font-medium">... e mais {importResult.errors.length - 10} erro(s)</li>
                    )}
                  </ul>
                </div>
              )}
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                className="btn-primary w-full"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Excluir médico"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Deseja realmente excluir <strong>{selectedDoctor?.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-secondary flex-1"
              disabled={isDeleting}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteDoctor}
              className="btn-danger flex-1"
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
