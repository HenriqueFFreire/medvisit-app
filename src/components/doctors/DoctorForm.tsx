import { useState, useRef, useMemo } from 'react';
import { Plus, Minus, Loader2 } from 'lucide-react';
import type { Doctor, Address, WorkingHours, AttendancePeriod } from '../../types';
import { MEDICAL_SPECIALTIES, DAYS_OF_WEEK, BRAZILIAN_STATES, PERIOD_TIMES } from '../../types';
import { validateEmail, validatePhone, validateCEP, formatCEP } from '../../utils/validation';
import { getAddressFromCEP } from '../../services/geocoding';
import { ButtonLoading } from '../common/Loading';

interface DoctorFormProps {
  doctor?: Doctor;
  doctors?: Doctor[];
  onSubmit: (data: DoctorFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface DoctorFormData {
  name: string;
  crm: string;
  specialty?: string;
  phone?: string;
  email?: string;
  address: Address;
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

export function DoctorForm({ doctor, doctors = [], onSubmit, onCancel, isLoading }: DoctorFormProps) {
  const [formData, setFormData] = useState<DoctorFormData>({
    name: doctor?.name || '',
    crm: doctor?.crm || '',
    specialty: doctor?.specialty || '',
    phone: doctor?.phone || '',
    email: doctor?.email || '',
    address: doctor?.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    },
    workingHours: doctor?.workingHours || DEFAULT_WORKING_HOURS,
    notes: doctor?.notes || '',
    hasPanel: doctor?.hasPanel ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [crmWarning, setCrmWarning] = useState<string | null>(null);
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);
  const [showCepSuggestions, setShowCepSuggestions] = useState(false);
  const [showComplementSuggestions, setShowComplementSuggestions] = useState(false);
  const cepSuggestionRef = useRef<HTMLDivElement>(null);
  const suggestionSelectedRef = useRef(false);
  const complementSuggestionSelectedRef = useRef(false);

  // Unique addresses already registered (excluding the doctor being edited)
  const knownAddresses = useMemo(() => {
    const seen = new Set<string>();
    return doctors
      .filter(d => d.id !== doctor?.id && d.address?.zipCode)
      .reduce<Array<Address & { doctorName: string }>>((acc, d) => {
        const key = d.address.zipCode.replace(/\D/g, '');
        if (!seen.has(key)) {
          seen.add(key);
          acc.push({ ...d.address, doctorName: d.name });
        }
        return acc;
      }, []);
  }, [doctors, doctor?.id]);

  const cepSuggestions = useMemo(() => {
    const raw = formData.address.zipCode.replace(/\D/g, '');
    if (!raw) return knownAddresses.slice(0, 8);
    return knownAddresses
      .filter(a => a.zipCode.replace(/\D/g, '').startsWith(raw))
      .slice(0, 8);
  }, [formData.address.zipCode, knownAddresses]);

  const complementSuggestions = useMemo(() => {
    const allComplements = [...new Set(
      doctors
        .filter(d => d.id !== doctor?.id && d.address?.complement)
        .map(d => d.address.complement as string)
    )].sort();
    const typed = formData.address.complement?.toLowerCase() || '';
    if (!typed) return allComplements.slice(0, 8);
    return allComplements
      .filter(c => c.toLowerCase().includes(typed))
      .slice(0, 8);
  }, [formData.address.complement, doctors, doctor?.id]);

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

  const handleAddressChange = (field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const applyCepSuggestion = (addr: Address) => {
    suggestionSelectedRef.current = true;
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        zipCode: addr.zipCode,
        street: addr.street,
        neighborhood: addr.neighborhood,
        city: addr.city,
        state: addr.state,
        complement: addr.complement || ''
      }
    }));
    setShowCepSuggestions(false);
    if (errors.zipCode) setErrors(prev => ({ ...prev, zipCode: '' }));
  };

  const handleCEPBlur = async () => {
    const cep = formData.address.zipCode;
    if (!validateCEP(cep)) return;

    setIsLoadingCEP(true);
    try {
      const addressData = await getAddressFromCEP(cep);
      if (addressData) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: addressData.street || prev.address.street,
            neighborhood: addressData.neighborhood || prev.address.neighborhood,
            city: addressData.city || prev.address.city,
            state: addressData.state || prev.address.state
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    } finally {
      setIsLoadingCEP(false);
    }
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

  const addWorkingHours = () => {
    const usedDays = formData.workingHours.map(wh => wh.dayOfWeek);
    const availableDay = [1, 2, 3, 4, 5, 6, 0].find(d => !usedDays.includes(d));
    if (availableDay !== undefined) {
      setFormData(prev => ({
        ...prev,
        workingHours: [...prev.workingHours, { dayOfWeek: availableDay }]
      }));
    }
  };

  const removeWorkingHours = (index: number) => {
    setFormData(prev => ({
      ...prev,
      workingHours: prev.workingHours.filter((_, i) => i !== index)
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.crm.trim()) {
      newErrors.crm = 'CRM é obrigatório';
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Telefone inválido';
    }

    if (!formData.address.street.trim()) {
      newErrors.street = 'Rua é obrigatória';
    }

    if (!formData.address.number.trim()) {
      newErrors.number = 'Número é obrigatório';
    }

    if (!formData.address.neighborhood.trim()) {
      newErrors.neighborhood = 'Bairro é obrigatório';
    }

    if (!formData.address.city.trim()) {
      newErrors.city = 'Cidade é obrigatória';
    }

    if (!formData.address.state) {
      newErrors.state = 'Estado é obrigatório';
    }

    if (!formData.address.zipCode.trim() || !validateCEP(formData.address.zipCode)) {
      newErrors.zipCode = 'CEP inválido';
    }

    if (formData.workingHours.length === 0) {
      newErrors.workingHours = 'Adicione pelo menos um horário de atendimento';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);
    if (!validate()) return;

    try {
      await onSubmit(formData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('DUPLICATE:')) {
        const [, name, crm] = msg.split(':');
        setDuplicateError(`Já existe um médico cadastrado com este CRM: ${name} (${crm})`);
      } else {
        throw err;
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
            <input
              type="text"
              className={`input ${errors.crm ? 'border-red-500' : ''}`}
              value={formData.crm}
              onChange={e => handleInputChange('crm', e.target.value)}
              placeholder="SP0001234"
            />
            {errors.crm && <p className="text-sm text-red-500 mt-1">{errors.crm}</p>}
            {!errors.crm && crmWarning && (
              <div className="mt-1 flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <p className="text-xs font-medium text-amber-700">{crmWarning}</p>
              </div>
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
        <h4 className="font-medium text-gray-900">Endereço</h4>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">CEP *</label>
            <div className="relative" ref={cepSuggestionRef}>
              <input
                type="text"
                className={`input ${errors.zipCode ? 'border-red-500' : ''}`}
                value={formData.address.zipCode}
                onChange={e => { handleAddressChange('zipCode', formatCEP(e.target.value)); setShowCepSuggestions(true); }}
                onFocus={() => setShowCepSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowCepSuggestions(false), 150);
                  if (!suggestionSelectedRef.current) handleCEPBlur();
                  suggestionSelectedRef.current = false;
                }}
                onKeyDown={e => { if (e.key === 'Escape') setShowCepSuggestions(false); }}
                placeholder="00000-000"
                maxLength={9}
                autoComplete="off"
              />
              {isLoadingCEP && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
              {showCepSuggestions && cepSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <p className="text-xs text-gray-400 px-3 pt-2 pb-1">CEPs já cadastrados</p>
                  {cepSuggestions.map((addr, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => applyCepSuggestion(addr)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-t border-gray-100 first:border-t-0"
                    >
                      <span className="font-mono text-sm font-medium text-blue-700">{addr.zipCode}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {addr.street}{addr.complement ? `, ${addr.complement}` : ''}, {addr.neighborhood} — {addr.city}/{addr.state}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.zipCode && <p className="text-sm text-red-500 mt-1">{errors.zipCode}</p>}
          </div>

          <div>
            <label className="label">Estado *</label>
            <select
              className={`input ${errors.state ? 'border-red-500' : ''}`}
              value={formData.address.state}
              onChange={e => handleAddressChange('state', e.target.value)}
            >
              <option value="">UF</option>
              {BRAZILIAN_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            {errors.state && <p className="text-sm text-red-500 mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="label">Cidade *</label>
            <input
              type="text"
              className={`input ${errors.city ? 'border-red-500' : ''}`}
              value={formData.address.city}
              onChange={e => handleAddressChange('city', e.target.value)}
              placeholder="São Paulo"
            />
            {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
          </div>
        </div>

        <div>
          <label className="label">Bairro *</label>
          <input
            type="text"
            className={`input ${errors.neighborhood ? 'border-red-500' : ''}`}
            value={formData.address.neighborhood}
            onChange={e => handleAddressChange('neighborhood', e.target.value)}
            placeholder="Centro"
          />
          {errors.neighborhood && <p className="text-sm text-red-500 mt-1">{errors.neighborhood}</p>}
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-3">
            <label className="label">Rua *</label>
            <input
              type="text"
              className={`input ${errors.street ? 'border-red-500' : ''}`}
              value={formData.address.street}
              onChange={e => handleAddressChange('street', e.target.value)}
              placeholder="Av. Paulista"
            />
            {errors.street && <p className="text-sm text-red-500 mt-1">{errors.street}</p>}
          </div>

          <div>
            <label className="label">Número *</label>
            <input
              type="text"
              className={`input ${errors.number ? 'border-red-500' : ''}`}
              value={formData.address.number}
              onChange={e => handleAddressChange('number', e.target.value)}
              placeholder="1000"
            />
            {errors.number && <p className="text-sm text-red-500 mt-1">{errors.number}</p>}
          </div>
        </div>

        <div>
          <label className="label">Complemento</label>
          <div className="relative">
            <input
              type="text"
              className="input"
              value={formData.address.complement}
              onChange={e => { handleAddressChange('complement', e.target.value); setShowComplementSuggestions(true); }}
              onFocus={() => setShowComplementSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowComplementSuggestions(false), 150);
                complementSuggestionSelectedRef.current = false;
              }}
              onKeyDown={e => { if (e.key === 'Escape') setShowComplementSuggestions(false); }}
              placeholder="Sala 101"
              autoComplete="off"
            />
            {showComplementSuggestions && complementSuggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                <p className="text-xs text-gray-400 px-3 pt-2 pb-1">Complementos já cadastrados</p>
                {complementSuggestions.map((complement, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => {
                      complementSuggestionSelectedRef.current = true;
                      handleAddressChange('complement', complement);
                      setShowComplementSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-t border-gray-100 first:border-t-0 text-sm text-gray-700"
                  >
                    {complement}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Horários de Atendimento *</h4>
          <button
            type="button"
            onClick={addWorkingHours}
            disabled={formData.workingHours.length >= 7}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {errors.workingHours && <p className="text-sm text-red-500">{errors.workingHours}</p>}

        <div className="space-y-3">
          {formData.workingHours.map((wh, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-lg">
              <select
                className="input w-40"
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Horário:</span>
                  <input
                    type="time"
                    className="input w-28"
                    value={wh.specificTime || ''}
                    onChange={e => handleWorkingHoursChange(index, 'specificTime', e.target.value)}
                    placeholder="HH:mm"
                  />
                </div>
              )}

              {wh.period && wh.period !== 'AG' && (
                <span className="text-xs text-gray-500">
                  {PERIOD_TIMES[wh.period].label}
                </span>
              )}

              <button
                type="button"
                onClick={() => removeWorkingHours(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg ml-auto"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          ))}
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
