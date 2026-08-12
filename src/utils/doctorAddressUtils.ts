import type { Address, Doctor, DoctorAddressEntry } from '../types';

export function createDoctorAddressEntry(address: Address, options: Partial<DoctorAddressEntry> = {}): DoctorAddressEntry {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `address-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    label: options.label ?? 'Endereço',
    address: { ...address },
    isPrimary: options.isPrimary ?? false
  };
}

export function normalizeDoctorAddresses(primaryAddress: Address, addresses?: DoctorAddressEntry[]): DoctorAddressEntry[] {
  const normalized = (addresses ?? [])
    .filter(Boolean)
    .map(entry => ({
      id: entry.id || createDoctorAddressEntry(primaryAddress).id,
      label: entry.label,
      address: { ...entry.address },
      isPrimary: Boolean(entry.isPrimary)
    }));

  if (normalized.length === 0) {
    return [createDoctorAddressEntry(primaryAddress, { label: 'Principal', isPrimary: true })];
  }

  const hasPrimary = normalized.some(entry => entry.isPrimary);
  if (!hasPrimary) {
    normalized[0].isPrimary = true;
  }

  return normalized.map((entry, index) => ({
    ...entry,
    address: { ...entry.address },
    isPrimary: entry.isPrimary || (index === 0 && !hasPrimary)
  }));
}

export function getDoctorPrimaryAddress(doctor: Pick<Doctor, 'address' | 'addresses'>): Address {
  const primaryEntry = (doctor.addresses ?? []).find(entry => entry.isPrimary);
  return (primaryEntry?.address ? { ...primaryEntry.address } : { ...doctor.address });
}

export function buildDoctorAddressState(primaryAddress: Address, addresses?: DoctorAddressEntry[]) {
  const normalized = normalizeDoctorAddresses(primaryAddress, addresses);
  return {
    primaryAddress: getDoctorPrimaryAddress({ address: primaryAddress, addresses: normalized }),
    addresses: normalized
  };
}
