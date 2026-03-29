import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Plus, ArrowLeft, Trash2, Edit, MapPin, Phone, FileText, Pill } from 'lucide-react';
import { usePharmacies } from '../hooks/usePharmacies';
import { PharmacyCard } from '../components/pharmacies/PharmacyCard';
import { PharmacyForm } from '../components/pharmacies/PharmacyForm';
import { Modal } from '../components/common/Modal';
import { PageLoading } from '../components/common/Loading';
import { EmptyState } from '../components/common/EmptyState';
import { formatFullAddress } from '../utils/format';
import type { Pharmacy } from '../types';
import type { PharmacyInput } from '../hooks/usePharmacies';

export function PharmaciesPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { pharmacies, isLoading, addPharmacy, updatePharmacy, deletePharmacy } = usePharmacies();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id === 'new') {
      setShowForm(true);
      setSelectedPharmacy(null);
    } else if (id) {
      const found = pharmacies.find(p => p.id === id);
      if (found) setSelectedPharmacy(found);
    } else {
      setSelectedPharmacy(null);
      setShowForm(false);
    }
  }, [id, pharmacies]);

  const filtered = pharmacies.filter(p =>
    !searchQuery ||
    (p.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.address.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address.neighborhood?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async (data: PharmacyInput) => {
    setIsSubmitting(true);
    try {
      await addPharmacy(data);
      setShowForm(false);
      if (id === 'new') navigate('/pharmacies');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: PharmacyInput) => {
    if (!selectedPharmacy) return;
    setIsSubmitting(true);
    try {
      await updatePharmacy(selectedPharmacy.id, data);
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPharmacy) return;
    setIsDeleting(true);
    try {
      await deletePharmacy(selectedPharmacy.id);
      setShowDeleteConfirm(false);
      navigate('/pharmacies');
    } catch {
      alert('Erro ao excluir farmácia. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <PageLoading />;

  // Detail view
  if (selectedPharmacy && !showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/pharmacies')} className="flex items-center text-gray-600">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
              <Edit className="w-5 h-5" />
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">💊</span>
              <h2 className="text-xl font-bold text-gray-900">{selectedPharmacy.name}</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start">
                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                <span className="text-gray-700">{formatFullAddress(selectedPharmacy.address)}</span>
              </div>
              {selectedPharmacy.phone && (
                <div className="flex items-center">
                  <Phone className="w-5 h-5 mr-3 text-gray-400" />
                  <a href={`tel:${selectedPharmacy.phone}`} className="text-blue-600">{selectedPharmacy.phone}</a>
                </div>
              )}
            </div>
          </div>

          {selectedPharmacy.notes && (
            <div className="card">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-gray-400" />
                Observações
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">{selectedPharmacy.notes}</p>
            </div>
          )}
        </div>

        {/* Delete Confirm */}
        <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Excluir farmácia" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Deseja realmente excluir <strong>{selectedPharmacy.name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="btn-danger flex-1" disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Form view
  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
          <button
            onClick={() => { setShowForm(false); if (id === 'new') navigate('/pharmacies'); }}
            className="flex items-center text-gray-600"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>
          <h1 className="ml-4 text-lg font-semibold">{selectedPharmacy ? 'Editar Farmácia' : 'Nova Farmácia'}</h1>
        </div>
        <div className="p-4">
          <div className="card">
            <PharmacyForm
              pharmacy={selectedPharmacy || undefined}
              onSubmit={selectedPharmacy ? handleUpdate : handleAdd}
              onCancel={() => { setShowForm(false); if (id === 'new') navigate('/pharmacies'); }}
              isLoading={isSubmitting}
            />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold">Farmácias</h1>
          <button
            onClick={() => { setSelectedPharmacy(null); setShowForm(true); }}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar farmácia..."
            className="input pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Pill}
            title={searchQuery ? 'Nenhuma farmácia encontrada' : 'Nenhuma farmácia cadastrada'}
            description={searchQuery ? 'Tente ajustar sua busca' : 'Cadastre sua primeira farmácia para começar'}
            action={
              !searchQuery ? (
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Farmácia
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map(pharmacy => (
              <PharmacyCard
                key={pharmacy.id}
                pharmacy={pharmacy}
                onClick={() => navigate(`/pharmacies/${pharmacy.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
