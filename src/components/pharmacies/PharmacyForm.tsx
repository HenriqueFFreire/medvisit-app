import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Pharmacy, Address } from '../../types';
import { BRAZILIAN_STATES } from '../../types';
import { validateCEP, formatCEP } from '../../utils/validation';
import { getAddressFromCEP } from '../../services/geocoding';
import { ButtonLoading } from '../common/Loading';
import type { PharmacyInput } from '../../hooks/usePharmacies';

interface PharmacyFormProps {
  pharmacy?: Pharmacy;
  onSubmit: (data: PharmacyInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PharmacyForm({ pharmacy, onSubmit, onCancel, isLoading }: PharmacyFormProps) {
  const [formData, setFormData] = useState<PharmacyInput>({
    name: pharmacy?.name || '',
    phone: pharmacy?.phone || '',
    address: pharmacy?.address || {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    },
    notes: pharmacy?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleAddressChange = (field: keyof Address, value: string) => {
    setFormData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleCEPBlur = async () => {
    const cep = formData.address.zipCode;
    if (!validateCEP(cep)) return;
    setIsLoadingCEP(true);
    try {
      const data = await getAddressFromCEP(cep);
      if (data) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: data.street || prev.address.street,
            neighborhood: data.neighborhood || prev.address.neighborhood,
            city: data.city || prev.address.city,
            state: data.state || prev.address.state,
          }
        }));
      }
    } catch {}
    finally { setIsLoadingCEP(false); }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.address.zipCode.trim() || !validateCEP(formData.address.zipCode)) errs.zipCode = 'CEP inválido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div>
        <label className="label">Nome da Farmácia <span className="text-gray-400 font-normal">(opcional)</span></label>
        <input
          type="text"
          className="input"
          value={formData.name}
          onChange={e => handleChange('name', e.target.value)}
          placeholder="Farmácia Central"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="label">Telefone</label>
        <input
          type="tel"
          className="input"
          value={formData.phone}
          onChange={e => handleChange('phone', e.target.value)}
          placeholder="(11) 99999-9999"
        />
      </div>

      {/* Address */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Endereço</h4>

        <div className="grid grid-cols-3 gap-3">
          {/* CEP */}
          <div>
            <label className="label">CEP *</label>
            <div className="relative">
              <input
                type="text"
                className={`input ${errors.zipCode ? 'border-red-500' : ''}`}
                value={formData.address.zipCode}
                onChange={e => handleAddressChange('zipCode', formatCEP(e.target.value))}
                onBlur={handleCEPBlur}
                placeholder="00000-000"
                maxLength={9}
              />
              {isLoadingCEP && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {errors.zipCode && <p className="text-sm text-red-500 mt-1">{errors.zipCode}</p>}
          </div>

          {/* State */}
          <div>
            <label className="label">Estado</label>
            <select
              className="input"
              value={formData.address.state}
              onChange={e => handleAddressChange('state', e.target.value)}
            >
              <option value="">UF</option>
              {BRAZILIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="label">Cidade</label>
            <input
              type="text"
              className="input"
              value={formData.address.city}
              onChange={e => handleAddressChange('city', e.target.value)}
              placeholder="São Paulo"
            />
          </div>
        </div>

        <div>
          <label className="label">Bairro</label>
          <input
            type="text"
            className="input"
            value={formData.address.neighborhood}
            onChange={e => handleAddressChange('neighborhood', e.target.value)}
            placeholder="Centro"
          />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <label className="label">Rua</label>
            <input
              type="text"
              className="input"
              value={formData.address.street}
              onChange={e => handleAddressChange('street', e.target.value)}
              placeholder="Av. Paulista"
            />
          </div>
          <div>
            <label className="label">Número</label>
            <input
              type="text"
              className="input"
              value={formData.address.number}
              onChange={e => handleAddressChange('number', e.target.value)}
              placeholder="100"
            />
          </div>
        </div>

        <div>
          <label className="label">Complemento</label>
          <input
            type="text"
            className="input"
            value={formData.address.complement}
            onChange={e => handleAddressChange('complement', e.target.value)}
            placeholder="Loja 1"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Observações</label>
        <textarea
          className="input min-h-[80px]"
          value={formData.notes}
          onChange={e => handleChange('notes', e.target.value)}
          placeholder="Anotações sobre a farmácia..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1" disabled={isLoading}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
          {isLoading ? <ButtonLoading /> : (pharmacy ? 'Salvar' : 'Cadastrar')}
        </button>
      </div>
    </form>
  );
}
