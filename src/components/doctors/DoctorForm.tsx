import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Loader2, Search } from 'lucide-react';
import type { Doctor, Address, DoctorAddressEntry, WorkingHours, AttendancePeriod, DoctorCategory, DirectoryDoctor } from '../../types';
import { MEDICAL_SPECIALTIES, DAYS_OF_WEEK, BRAZILIAN_STATES, PERIOD_TIMES } from '../../types';
import { validateEmail, validatePhone, validateCEP, formatCEP } from '../../utils/validation';
import { getAddressFromCEP } from '../../services/geocoding';
import { ButtonLoading } from '../common/Loading';
import { createDoctorAddressEntry, buildDoctorAddressState } from '../../utils/doctorAddressUtils';
import { findDirectoryDoctor } from '../../services/doctorDirectory';

interface DoctorFormProps {
  doctor?: Doctor;
  doctors?: Doctor[];
  onSubmit: (data: DoctorFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  initialCrm?: string;
}

export interface DoctorFormData {
  name: string;
  crm: string;
  specialty?: string;
  category?: DoctorCategory;
  phone?: string;
  email?: string;
  birthDate?: string;
  address: Address;
  addresses?: DoctorAddressEntry[];
  workingHours: WorkingHours[];
  notes?: string;
  hasPanel?: boolean;
}

const DEFAULT_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 1 },
  { dayOfWeek: 2 },
  { dayOfWeek: 3 },
  { dayOfWeek: 4 },
  { dayOfWeek: 5 }
];

const BIRTHDAY_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getBirthdayParts(value?: string): { day: number | ''; month: number | '' } {
  if (!value) return { day: '', month: '' };
  const parts = value.split('-').map(Number);
  const [month, day] = parts.length === 2 ? parts : parts.slice(1);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
    ? { month, day }
    : { day: '', month: '' };
}

function getDaysInBirthdayMonth(month: number | ''): number {
  if (!month) return 31;
  // Leap year keeps 29 February available because the birth year is intentionally omitted.
  return new Date(2024, month, 0).getDate();
}

export function DoctorForm({ doctor, doctors = [], onSubmit, onCancel, isLoading, initialCrm = '' }: DoctorFormProps) {
  const initialAddressState = useMemo(() => {
    const primaryAddress = doctor?.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    };
    return buildDoctorAddressState(primaryAddress, doctor?.addresses);
  }, [doctor]);

  const defaultFormData = useMemo<DoctorFormData>(() => ({
    name: doctor?.name || '',
    crm: doctor?.crm || initialCrm,
    specialty: doctor?.specialty || '',
    category: doctor?.category || 'B',
    phone: doctor?.phone || '',
    email: doctor?.email || '',
    birthDate: doctor?.birthDate || '',
    address: initialAddressState.primaryAddress,
    addresses: initialAddressState.addresses,
    workingHours: (doctor?.workingHours || DEFAULT_WORKING_HOURS).map(wh => ({
      ...wh,
      addressId: wh.addressId ?? initialAddressState.addresses.find(entry => entry.isPrimary)?.id
    })),
    notes: doctor?.notes || '',
    hasPanel: doctor?.hasPanel ?? true
  }), [doctor, initialAddressState, initialCrm]);

  const [formData, setFormData] = useState<DoctorFormData>(defaultFormData);

  useEffect(() => {
    setFormData(defaultFormData);
  }, [defaultFormData]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [crmWarning, setCrmWarning] = useState<string | null>(null);
  const [loadingAddressId, setLoadingAddressId] = useState<string | null>(null);
  const [isSearchingDirectory, setIsSearchingDirectory] = useState(false);
  const [directoryResult, setDirectoryResult] = useState<DirectoryDoctor | null>(null);
  const [selectedDirectoryAddressIds, setSelectedDirectoryAddressIds] = useState<string[]>([]);
  const [directoryMessage, setDirectoryMessage] = useState<string | null>(null);
  const initialBirthday = getBirthdayParts(doctor?.birthDate);
  const [birthdayDay, setBirthdayDay] = useState<number | ''>(initialBirthday.day);
  const [birthdayMonth, setBirthdayMonth] = useState<number | ''>(initialBirthday.month);

  useEffect(() => {
    if (doctor || !initialCrm) return;
    let active = true;
    setIsSearchingDirectory(true);
    findDirectoryDoctor(initialCrm)
      .then(result => {
        if (!active) return;
        setDirectoryResult(result);
        setSelectedDirectoryAddressIds([]);
        setDirectoryMessage(result ? null : 'CRM não encontrado no Diretório MedVisit.');
      })
      .catch(() => active && setDirectoryMessage('Não foi possível consultar o diretório. Tente novamente.'))
      .finally(() => active && setIsSearchingDirectory(false));
    return () => { active = false; };
  }, [doctor, initialCrm]);

  useEffect(() => {
    const parts = getBirthdayParts(doctor?.birthDate);
    setBirthdayDay(parts.day);
    setBirthdayMonth(parts.month);
  }, [doctor]);

  const updateBirthday = (field: 'day' | 'month', value: string) => {
    const next = {
      day: field === 'day' ? (value ? Number(value) : '') : birthdayDay,
      month: field === 'month' ? (value ? Number(value) : '') : birthdayMonth
    };
    if (field === 'day') setBirthdayDay(next.day);
    if (field === 'month') setBirthdayMonth(next.month);
    if (next.month && next.day) {
      const maxDay = getDaysInBirthdayMonth(next.month);
      const validDay = Math.min(Number(next.day), maxDay);
      setBirthdayDay(validDay);
      setFormData(prev => ({
        ...prev,
        birthDate: `${String(next.month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`
      }));
    } else {
      setFormData(prev => ({ ...prev, birthDate: '' }));
    }
  };
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if ((field === 'name' || field === 'crm') && duplicateError) setDuplicateError(null);
    if (field === 'crm') {
      const normalize = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase();
      const normValue = normalize(value);
      const existing = normValue
        ? doctors.find(d => d.id !== doctor?.id && normalize(d.crm) === normValue)
        : null;
      setCrmWarning(existing ? `CRM já cadastrado: ${existing.name}` : null);
    }
  };

  const addAddress = () => {
    setFormData(prev => {
      const currentAddresses = prev.addresses ?? [];
      const newEntry = createDoctorAddressEntry({
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: ''
      }, { label: `Endereço ${currentAddresses.length + 1}`, isPrimary: currentAddresses.length === 0 });

      return {
        ...prev,
        addresses: [...currentAddresses, newEntry],
        address: currentAddresses.length === 0 ? { ...newEntry.address } : prev.address,
        workingHours: [
          ...prev.workingHours,
          ...DEFAULT_WORKING_HOURS.map(wh => ({ ...wh, addressId: newEntry.id }))
        ]
      };
    });
  };

  const updateAddressEntry = (id: string, patch: Partial<DoctorAddressEntry>) => {
    setFormData(prev => {
      const nextAddresses = (prev.addresses ?? []).map(entry => entry.id === id ? { ...entry, ...patch } : entry);
      const primaryAddress = nextAddresses.find(entry => entry.isPrimary)?.address ?? prev.address;
      return {
        ...prev,
        addresses: nextAddresses,
        address: primaryAddress
      };
    });
  };

  const searchDirectory = async () => {
    if (!formData.crm.trim()) {
      setErrors(prev => ({ ...prev, crm: 'Informe o CRM para pesquisar' }));
      return;
    }
    setIsSearchingDirectory(true);
    setDirectoryResult(null);
    setDirectoryMessage(null);
    try {
      const result = await findDirectoryDoctor(formData.crm);
      setDirectoryResult(result);
      // Shared addresses are suggestions and must be explicitly selected by the user.
      setSelectedDirectoryAddressIds([]);
      setDirectoryMessage(result ? null : 'CRM não encontrado no Diretório MedVisit.');
    } catch (error) {
      console.error('Erro ao consultar Diretório MedVisit:', error);
      setDirectoryMessage('Não foi possível consultar o diretório. Tente novamente.');
    } finally {
      setIsSearchingDirectory(false);
    }
  };

  const importDirectoryResult = () => {
    if (!directoryResult) return;
    const selectedAddresses = directoryResult.addresses.filter(entry => selectedDirectoryAddressIds.includes(entry.id));
    setFormData(prev => {
      if (selectedAddresses.length > 0) {
        const addressIdMap = new Map<string, string>();
        const importedAddresses = selectedAddresses.map((entry, index) => {
          const imported = createDoctorAddressEntry(entry.address, {
            label: entry.label,
            isPrimary: index === 0
          });
          addressIdMap.set(entry.id, imported.id);
          return imported;
        });
        const importedHours = directoryResult.workingHours
          .filter(hour => hour.addressId && addressIdMap.has(hour.addressId))
          .map(hour => ({ ...hour, addressId: addressIdMap.get(hour.addressId!) }));

        return {
          ...prev,
          name: directoryResult.name,
          crm: directoryResult.crm,
          specialty: directoryResult.specialty ?? prev.specialty,
          addresses: importedAddresses,
          address: { ...importedAddresses[0].address },
          workingHours: importedHours
        };
      }

      const nextAddresses = (prev.addresses ?? []).map(entry => entry.isPrimary ? {
        ...entry,
        address: {
          ...entry.address,
          city: directoryResult.city || entry.address.city,
          state: directoryResult.state || entry.address.state
        }
      } : entry);
      return {
        ...prev,
        name: directoryResult.name,
        crm: directoryResult.crm,
        specialty: directoryResult.specialty ?? prev.specialty,
        addresses: nextAddresses,
        address: {
          ...prev.address,
          city: directoryResult.city || prev.address.city,
          state: directoryResult.state || prev.address.state
        }
      };
    });
    setErrors(prev => ({ ...prev, name: '', crm: '', city: '', state: '' }));
    setDirectoryMessage(selectedAddresses.length > 0
      ? `${selectedAddresses.length} endereço(s) e seus horários foram importados.`
      : 'Dados profissionais importados. Complete o endereço e os horários.');
    setDirectoryResult(null);
    setSelectedDirectoryAddressIds([]);
  };

  const fillAddressFromCEP = async (entry: DoctorAddressEntry) => {
    if (!validateCEP(entry.address.zipCode)) return;

    setLoadingAddressId(entry.id);
    try {
      const addressData = await getAddressFromCEP(entry.address.zipCode);
      if (addressData) {
        updateAddressEntry(entry.id, {
          address: {
            ...entry.address,
            street: addressData.street || entry.address.street,
            neighborhood: addressData.neighborhood || entry.address.neighborhood,
            city: addressData.city || entry.address.city,
            state: addressData.state || entry.address.state
          }
        });
      }
    } finally {
      setLoadingAddressId(null);
    }
  };

  const removeAddressEntry = (id: string) => {
    setFormData(prev => {
      const nextAddresses = (prev.addresses ?? []).filter(entry => entry.id !== id);
      const fallback = nextAddresses[0];
      const normalizedAddresses = nextAddresses.map((entry, index) => ({
        ...entry,
        isPrimary: index === 0
      }));
      return {
        ...prev,
        addresses: normalizedAddresses,
        address: fallback ? { ...fallback.address } : prev.address,
        workingHours: prev.workingHours.filter(wh => wh.addressId !== id)
      };
    });
    setErrors(prev => ({
      ...prev,
      addresses: '',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    }));
  };

  const setPrimaryAddress = (id: string) => {
    setFormData(prev => {
      const nextAddresses = (prev.addresses ?? []).map(entry => ({
        ...entry,
        isPrimary: entry.id === id
      }));
      const primary = nextAddresses.find(entry => entry.isPrimary)?.address ?? prev.address;
      return {
        ...prev,
        addresses: nextAddresses,
        address: { ...primary }
      };
    });
  };

  const handleWorkingHoursChange = (index: number, field: keyof WorkingHours, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      workingHours: prev.workingHours.map((wh, i) => {
        if (i !== index) return wh;
        const updated = { ...wh, [field]: value };
        // Clear specificTime if period is not AG (or cleared)
        if (field === 'period' && value !== 'AG') {
          updated.specificTime = undefined;
        }
        return updated;
      })
    }));
  };

  const addWorkingHours = (addressId?: string) => {
    setFormData(prev => {
      const primaryAddressId = prev.addresses?.find(entry => entry.isPrimary)?.id;
      const targetAddressId = addressId ?? primaryAddressId;
      const usedDaysAtAddress = prev.workingHours
        .filter(wh => (wh.addressId ?? primaryAddressId) === targetAddressId)
        .map(wh => wh.dayOfWeek);
      const availableDay = [1, 2, 3, 4, 5, 6, 0].find(day => !usedDaysAtAddress.includes(day)) ?? 1;

      return {
        ...prev,
        workingHours: [...prev.workingHours, {
          dayOfWeek: availableDay,
          addressId: targetAddressId
        }]
      };
    });
  };

  const removeWorkingHours = (index: number) => {
    setFormData(prev => ({
      ...prev,
      workingHours: prev.workingHours.filter((_, i) => i !== index)
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

    if (!hasText(formData.name)) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!hasText(formData.crm)) {
      newErrors.crm = 'CRM é obrigatório';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Telefone inválido';
    }

    if (!hasText(formData.address.street)) {
      newErrors.street = 'Rua é obrigatória';
    }

    if (!hasText(formData.address.number)) {
      newErrors.number = 'Número é obrigatório';
    }

    if (!hasText(formData.address.neighborhood)) {
      newErrors.neighborhood = 'Bairro é obrigatório';
    }

    if (!hasText(formData.address.city)) {
      newErrors.city = 'Cidade é obrigatória';
    }

    if (!formData.address.state) {
      newErrors.state = 'Estado é obrigatório';
    }

    if (!hasText(formData.address.zipCode) || !validateCEP(formData.address.zipCode)) {
      newErrors.zipCode = 'CEP inválido';
    }

    if ((formData.addresses ?? []).length > 0) {
      const invalidEntries = (formData.addresses ?? []).filter(entry => {
        const address = entry?.address;
        return !address || !hasText(address.street) || !hasText(address.city) || !hasText(address.state);
      });
      if (invalidEntries.length > 0) {
        newErrors.addresses = 'Preencha os campos obrigatórios dos endereços adicionais';
      }
    }

    if (formData.workingHours.length === 0) {
      newErrors.workingHours = 'Adicione pelo menos um horário de atendimento';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    setSubmitError(isValid ? null : 'Revise os campos destacados antes de salvar.');

    if (!isValid) {
      requestAnimationFrame(() => {
        document.querySelector('.border-red-500, [data-form-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);
    try {
      if (!validate()) return;
    } catch (err) {
      console.error('Erro ao validar formulário de médico:', err);
      setSubmitError('Não foi possível validar os dados deste cadastro. Revise os endereços e tente novamente.');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('DUPLICATE:')) {
        const [, name, crm] = msg.split(':');
        setDuplicateError(`Já existe um médico cadastrado com este CRM: ${name} (${crm})`);
      } else {
        console.error('Erro no submit do formulário de médico:', err);
        alert(`Erro ao salvar médico: ${msg}`);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Informações Básicas</h4>

        <div>
          <label className="label">Nome completo *</label>
          <input
            type="text"
            className={`input ${errors.name ? 'border-red-500' : ''}`}
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            placeholder="Dr. João Silva"
          />
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">CRM *</label>
            <div className="flex gap-2">
              <input
                type="text"
                className={`input flex-1 ${errors.crm ? 'border-red-500' : ''}`}
                value={formData.crm}
                onChange={e => {
                  handleInputChange('crm', e.target.value);
                  setDirectoryResult(null);
                  setSelectedDirectoryAddressIds([]);
                  setDirectoryMessage(null);
                }}
                placeholder="SP0001234"
              />
              {!doctor && (
                <button
                  type="button"
                  onClick={searchDirectory}
                  disabled={isSearchingDirectory}
                  className="btn-secondary px-3 shrink-0"
                  title="Buscar no Diretório MedVisit"
                >
                  {isSearchingDirectory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="hidden sm:inline ml-2">Buscar</span>
                </button>
              )}
            </div>
            {errors.crm && <p className="text-sm text-red-500 mt-1">{errors.crm}</p>}
            {!errors.crm && crmWarning && (
              <div className="mt-1 flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-medium text-amber-700">{crmWarning}</p>
              </div>
            )}
            {!doctor && isSearchingDirectory && (
              <p className="text-sm text-gray-600 mt-2" role="status">
                Consultando o Diretório MedVisit...
              </p>
            )}
            {!doctor && directoryResult && (
              <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-blue-900">{directoryResult.name}</p>
                <p className="text-xs text-blue-700 mt-1">
                  CRM {directoryResult.crm}
                  {directoryResult.specialty ? ` • ${directoryResult.specialty}` : ''}
                  {(directoryResult.city || directoryResult.state) ? ` • ${directoryResult.city}/${directoryResult.state}` : ''}
                </p>
                {directoryResult.addresses.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-900">Escolha os endereços que deseja importar:</p>
                    {directoryResult.addresses.map((entry, index) => {
                      const addressHours = directoryResult.workingHours.filter(hour => hour.addressId === entry.id);
                      return (
                        <label key={entry.id} className="flex items-start gap-2 rounded-lg border border-blue-200 bg-white p-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedDirectoryAddressIds.includes(entry.id)}
                            onChange={event => setSelectedDirectoryAddressIds(current => event.target.checked
                              ? [...current, entry.id]
                              : current.filter(id => id !== entry.id))}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-gray-800">
                              {entry.address.attendanceLocation || entry.label || `Endereço ${index + 1}`}
                            </span>
                            <span className="block text-xs text-gray-600">
                              {entry.address.street}, {entry.address.number}
                              {entry.address.complement ? `, ${entry.address.complement}` : ''}
                              {entry.address.neighborhood ? ` — ${entry.address.neighborhood}` : ''}
                              {` — ${entry.address.city}/${entry.address.state}`}
                            </span>
                            <span className="block text-xs text-blue-700 mt-1">
                              {addressHours.length > 0
                                ? addressHours.map(hour => {
                                    const day = DAYS_OF_WEEK.find(item => item.value === hour.dayOfWeek)?.label ?? 'Dia';
                                    const period = hour.period === 'AG' && hour.specificTime
                                      ? hour.specificTime
                                      : hour.period ? PERIOD_TIMES[hour.period].label : 'horário não informado';
                                    return `${day}: ${period}`;
                                  }).join(' • ')
                                : 'Nenhum horário cadastrado'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={importDirectoryResult}
                  className="btn-primary px-3 py-1.5 text-sm mt-3"
                >
                  {selectedDirectoryAddressIds.length > 0
                    ? 'Importar dados e endereços selecionados'
                    : 'Importar somente dados profissionais'}
                </button>
              </div>
            )}
            {!doctor && directoryMessage && (
              <p
                className={`text-sm mt-2 ${directoryMessage.startsWith('Dados') ? 'text-green-700' : 'text-gray-600'}`}
                role="status"
              >
                {directoryMessage}
              </p>
            )}
          </div>

          <div>
            <label className="label">Especialidade</label>
            <select
              className="input"
              value={formData.specialty}
              onChange={e => handleInputChange('specialty', e.target.value)}
            >
              <option value="">Selecione...</option>
              {MEDICAL_SPECIALTIES.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Telefone</label>
            <input
              type="tel"
              className={`input ${errors.phone ? 'border-red-500' : ''}`}
              value={formData.phone}
              onChange={e => handleInputChange('phone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
            {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className={`input ${errors.email ? 'border-red-500' : ''}`}
              value={formData.email}
              onChange={e => handleInputChange('email', e.target.value)}
              placeholder="medico@email.com"
            />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
          </div>
        </div>

        <div>
          <label className="label">Aniversário</label>
          <div className="grid grid-cols-2 gap-3">
            <select
              className="input"
              aria-label="Dia do aniversário"
              value={birthdayDay}
              onChange={event => updateBirthday('day', event.target.value)}
            >
              <option value="">Dia</option>
              {Array.from({ length: getDaysInBirthdayMonth(birthdayMonth) }, (_, index) => index + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <select
              className="input"
              aria-label="Mês do aniversário"
              value={birthdayMonth}
              onChange={event => updateBirthday('month', event.target.value)}
            >
              <option value="">Mês</option>
              {BIRTHDAY_MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>{month}</option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-gray-500">Informe somente o dia e o mês para os lembretes da página inicial.</p>
        </div>

        <div>
          <label className="label">Categoria</label>
          <select
            className="input"
            value={formData.category || 'B'}
            onChange={e => handleInputChange('category', e.target.value)}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">A categoria ajuda a priorizar a ordem de visita no roteiro.</p>
        </div>

        {/* Painel */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setFormData(prev => ({ ...prev, hasPanel: !prev.hasPanel }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${formData.hasPanel ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.hasPanel ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {formData.hasPanel ? 'Com painel' : 'Sem painel'}
          </span>
        </label>

      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Endereços</h4>
          <button type="button" onClick={addAddress} className="text-sm text-blue-600 hover:text-blue-700">
            + Adicionar endereço
          </button>
        </div>

        {errors.addresses && <p className="text-sm text-red-500">{errors.addresses}</p>}

        {(formData.addresses ?? []).length > 0 && (
          <div className="space-y-3 pt-2">
            {formData.addresses?.map((entry, index) => (
              <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="primary-address"
                      checked={entry.isPrimary}
                      onChange={() => setPrimaryAddress(entry.id)}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {entry.isPrimary ? 'Endereço principal' : (entry.label || `Endereço ${index + 1}`)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!entry.isPrimary && (
                      <button type="button" onClick={() => setPrimaryAddress(entry.id)} className="text-xs text-blue-600 hover:text-blue-700">
                        Definir principal
                      </button>
                    )}
                    {(formData.addresses?.length ?? 0) > 1 && (
                      <button type="button" onClick={() => removeAddressEntry(entry.id)} className="text-xs text-red-600 hover:text-red-700">
                        Remover
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">CEP</label>
                    <div className="relative">
                      <input
                        type="text"
                        className={`input ${entry.isPrimary && errors.zipCode ? 'border-red-500' : ''}`}
                        value={entry.address.zipCode}
                        onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, zipCode: formatCEP(e.target.value) } })}
                        onBlur={() => fillAddressFromCEP(entry)}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {loadingAddressId === entry.id && (
                        <Loader2 className="absolute right-3 top-1/2 w-4 h-4 -translate-y-1/2 animate-spin text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="label">Estado</label>
                    <select
                      className={`input ${entry.isPrimary && errors.state ? 'border-red-500' : ''}`}
                      value={entry.address.state}
                      onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, state: e.target.value } })}
                    >
                      <option value="">UF</option>
                      {BRAZILIAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Cidade</label>
                    <input
                      type="text"
                      className={`input ${entry.isPrimary && errors.city ? 'border-red-500' : ''}`}
                      value={entry.address.city}
                      onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, city: e.target.value } })}
                      placeholder="São Paulo"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Bairro</label>
                  <input
                    type="text"
                    className={`input ${entry.isPrimary && errors.neighborhood ? 'border-red-500' : ''}`}
                    value={entry.address.neighborhood}
                    onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, neighborhood: e.target.value } })}
                    placeholder="Centro"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                    <label className="label">Rua</label>
                    <input
                      type="text"
                      className={`input ${entry.isPrimary && errors.street ? 'border-red-500' : ''}`}
                      value={entry.address.street}
                      onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, street: e.target.value } })}
                      placeholder="Av. Paulista"
                    />
                  </div>
                  <div>
                    <label className="label">Número</label>
                    <input
                      type="text"
                      className={`input ${entry.isPrimary && errors.number ? 'border-red-500' : ''}`}
                      value={entry.address.number}
                      onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, number: e.target.value } })}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Complemento</label>
                  <input
                    type="text"
                    className="input"
                    value={entry.address.complement ?? ''}
                    onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, complement: e.target.value } })}
                    placeholder="Sala 101"
                  />
                </div>

                <div>
                  <label className="label">Local de atendimento</label>
                  <input
                    type="text"
                    className="input"
                    value={entry.address.attendanceLocation ?? ''}
                    onChange={e => updateAddressEntry(entry.id, { address: { ...entry.address, attendanceLocation: e.target.value } })}
                    placeholder="Ex.: Hospital Central, Clínica Vida"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Horários de Atendimento *</h4>

        {errors.workingHours && <p className="text-sm text-red-500">{errors.workingHours}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {(formData.addresses ?? []).map((addressEntry, addressIndex) => {
            const primaryAddressId = formData.addresses?.find(entry => entry.isPrimary)?.id;
            const addressHours = formData.workingHours
              .map((wh, index) => ({ wh, index }))
              .filter(({ wh }) => (wh.addressId ?? primaryAddressId) === addressEntry.id);

            return (
              <section key={addressEntry.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-start justify-between gap-3 bg-blue-50 border-b border-blue-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-900">
                      {addressEntry.isPrimary ? 'Endereço principal' : (addressEntry.label || `Endereço ${addressIndex + 1}`)}
                    </p>
                    {addressEntry.address.attendanceLocation && (
                      <p className="text-xs font-medium text-blue-800 mt-0.5 truncate">
                        {addressEntry.address.attendanceLocation}
                      </p>
                    )}
                    <p className="text-xs text-blue-700 mt-0.5 truncate" title={`${addressEntry.address.street}, ${addressEntry.address.number}`}>
                      {addressEntry.address.street}, {addressEntry.address.number}
                      {addressEntry.address.complement ? `, ${addressEntry.address.complement}` : ''}
                      {addressEntry.address.neighborhood ? ` — ${addressEntry.address.neighborhood}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addWorkingHours(addressEntry.id)}
                    disabled={addressHours.length >= 7}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2 p-3">
                  {addressHours.length === 0 && (
                    <p className="text-xs text-gray-400 py-3 text-center">Nenhum horário neste endereço</p>
                  )}
                  {addressHours.map(({ wh, index }) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
                      <select
                        className="input w-36"
                        value={wh.dayOfWeek}
                        onChange={e => handleWorkingHoursChange(index, 'dayOfWeek', parseInt(e.target.value))}
                      >
                        {DAYS_OF_WEEK.map(day => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        {(['M', 'T', 'MT', 'AG'] as AttendancePeriod[]).map(period => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => handleWorkingHoursChange(index, 'period', wh.period === period ? undefined : period)}
                            className={`px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                              wh.period === period
                                ? period === 'M'
                                  ? 'bg-amber-500 text-white'
                                  : period === 'T'
                                    ? 'bg-orange-500 text-white'
                                    : period === 'MT'
                                      ? 'bg-green-500 text-white'
                                      : 'bg-blue-500 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                            title={PERIOD_TIMES[period].label}
                          >
                            {period}
                          </button>
                        ))}
                      </div>

                      {wh.period === 'AG' && (
                        <input
                          type="time"
                          aria-label="Horário agendado"
                          className="input w-28"
                          value={wh.specificTime || ''}
                          onChange={e => handleWorkingHoursChange(index, 'specificTime', e.target.value)}
                        />
                      )}

                      {wh.period && wh.period !== 'AG' && (
                        <span className="text-[11px] text-gray-500">{PERIOD_TIMES[wh.period].label}</span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeWorkingHours(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg ml-auto"
                        aria-label="Remover horário"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Observações</label>
        <textarea
          className="input min-h-[100px]"
          value={formData.notes}
          onChange={e => handleInputChange('notes', e.target.value)}
          placeholder="Anotações sobre o médico..."
        />
      </div>

      {/* Duplicate warning */}
      {duplicateError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-red-700">{duplicateError}</p>
        </div>
      )}

      {submitError && (
        <div data-form-error="true" role="alert" className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary flex-1"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={isLoading}
        >
          {isLoading ? <ButtonLoading /> : (doctor ? 'Salvar' : 'Cadastrar')}
        </button>
      </div>
    </form>
  );
}
