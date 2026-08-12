import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { geocodeAddress } from '../services/geocoding';
import type { Doctor, Address, DoctorAddressEntry, WorkingHours, AttendancePeriod, DoctorCategory } from '../types';
import { normalizeDoctorAddresses } from '../utils/doctorAddressUtils';

interface UseDoctorsResult {
  doctors: Doctor[];
  isLoading: boolean;
  error: string | null;
  addDoctor: (data: CreateDoctorInput) => Promise<Doctor>;
  updateDoctor: (id: string, data: Partial<Doctor>) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  getDoctor: (id: string) => Promise<Doctor | undefined>;
  searchDoctors: (query: string) => Promise<Doctor[]>;
  importDoctorsFromCSV: (csvContent: string) => Promise<{ success: number; errors: string[] }>;
  refreshDoctors: () => Promise<void>;
  markVisited: (id: string) => Promise<void>;
}

interface CreateDoctorInput {
  name: string;
  crm: string;
  specialty?: string;
  category?: DoctorCategory;
  phone?: string;
  email?: string;
  address: Address;
  addresses?: DoctorAddressEntry[];
  workingHours: WorkingHours[];
  notes?: string;
  hasPanel?: boolean;
}

// Firestore rejects `undefined`, including inside nested objects. Keep optional
// address fields absent when they have no value instead of serializing them as
// `undefined`.
function createPersistableAddress(address: Address): Address {
  return {
    street: address.street ?? '',
    number: address.number ?? '',
    neighborhood: address.neighborhood ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    zipCode: address.zipCode ?? '',
    ...(address.complement != null && address.complement !== '' ? { complement: address.complement } : {}),
    ...(address.fullAddress != null && address.fullAddress !== '' ? { fullAddress: address.fullAddress } : {})
  };
}

function mapDocToDoctor(id: string, data: Record<string, unknown>): Doctor {
  return {
    id,
    name: data.name as string,
    crm: data.crm as string,
    specialty: data.specialty as string | undefined,
    category: (data.category as DoctorCategory | undefined) ?? 'B',
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    address: data.address as Address,
    addresses: (data.addresses as DoctorAddressEntry[] | undefined) ?? [],
    coordinates: data.coordinates as Doctor['coordinates'],
    workingHours: (data.workingHours as WorkingHours[]) ?? [],
    notes: data.notes as string | undefined,
    hasPanel: data.hasPanel as boolean | undefined,
    lastVisitDate: data.lastVisitDate ? new Date(data.lastVisitDate as string) : undefined,
    lastRoutedDate: data.lastRoutedDate ? new Date(data.lastRoutedDate as string) : undefined,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
    syncStatus: 'synced'
  };
}

export function useDoctors(): UseDoctorsResult {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const withTimeout = async <T>(promise: Promise<T>, ms = 15000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Operação demorou demais. Tente novamente.')), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]) as T;
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const loadDoctors = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users', user.id, 'doctors'), orderBy('name'));
      const snap = await withTimeout(getDocs(q));
      setDoctors(snap.docs.map(d => mapDocToDoctor(d.id, d.data() as Record<string, unknown>)));
      setError(null);
    } catch (err) {
      setError('Erro ao carregar médicos');
      console.error('Error loading doctors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  // Returns existing doctor if CRM already registered (ignores case/whitespace)
  // CRM duplicate = same state prefix AND same number (e.g. SP12345 == SP12345, but SP12345 != RJ12345)
  const checkDuplicate = (data: { name: string; crm: string }, excludeId?: string): Doctor | null => {
    const normCrm = data.crm.toUpperCase().trim();
    for (const d of doctors) {
      if (excludeId && d.id === excludeId) continue;
      const dCrm = d.crm.toUpperCase().trim();
      if (normCrm && dCrm && normCrm === dCrm) return d;
    }
    return null;
  };

  const addDoctor = async (data: CreateDoctorInput): Promise<Doctor> => {
    if (!user) throw new Error('Usuário não autenticado');

    const dup = checkDuplicate(data);
    if (dup) throw new Error(`DUPLICATE:${dup.name}:${dup.crm}`);

    let coordinates: Doctor['coordinates'] = undefined;
    try {
      coordinates = await geocodeAddress(data.address) || undefined;
    } catch {
      // geocoding failure is non-fatal
    }

    const now = new Date().toISOString();
    const primaryAddress = createPersistableAddress(data.address);
    const serializedAddresses = normalizeDoctorAddresses(primaryAddress, data.addresses ?? []).map(entry => ({
      id: entry.id,
      label: entry.label ?? 'Endereço',
      isPrimary: entry.isPrimary,
      address: createPersistableAddress(entry.address)
    }));
    const docData = {
      name: data.name,
      crm: data.crm,
      specialty: data.specialty ?? null,
      category: data.category ?? 'B',
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: primaryAddress,
      addresses: serializedAddresses,
      coordinates: coordinates ?? null,
      workingHours: data.workingHours.map(wh => ({
        dayOfWeek: wh.dayOfWeek,
        addressId: wh.addressId ?? null,
        period: wh.period ?? null,
        specificTime: wh.specificTime ?? null
      })),
      notes: data.notes ?? null,
      hasPanel: data.hasPanel ?? null,
      lastVisitDate: null,
      createdAt: now,
      updatedAt: now
    };

    const ref = await withTimeout(addDoc(collection(db, 'users', user.id, 'doctors'), docData));
    const newDoctor = mapDocToDoctor(ref.id, docData as Record<string, unknown>);
    setDoctors(prev => [...prev, newDoctor].sort((a, b) => a.name.localeCompare(b.name)));
    return newDoctor;
  };

  const updateDoctor = async (id: string, data: Partial<Doctor>): Promise<void> => {
    console.log('updateDoctor start', id, data);
    if (!user) throw new Error('Usuário não autenticado');
    let existing = doctors.find(d => d.id === id);
    if (!existing) {
      console.log('updateDoctor fetching existing doctor from Firestore');
      const snap = await withTimeout(getDoc(doc(db, 'users', user.id, 'doctors', id)));
      if (!snap.exists()) throw new Error('Médico não encontrado');
      existing = mapDocToDoctor(snap.id, snap.data() as Record<string, unknown>);
    }

    if (data.name !== undefined || data.crm !== undefined) {
      const dup = checkDuplicate({ name: data.name ?? existing.name, crm: data.crm ?? existing.crm }, id);
      if (dup) throw new Error(`DUPLICATE:${dup.name}:${dup.crm}`);
    }

    let coordinates = existing.coordinates;
    if (data.address && JSON.stringify(data.address) !== JSON.stringify(existing.address)) {
      try {
        coordinates = await geocodeAddress(data.address) || undefined;
      } catch {
        // geocoding failure is non-fatal
      }
    }

    const primaryAddress = createPersistableAddress({
      street: data.address?.street ?? existing.address.street,
      number: data.address?.number ?? existing.address.number,
      complement: data.address?.complement ?? existing.address.complement,
      neighborhood: data.address?.neighborhood ?? existing.address.neighborhood,
      city: data.address?.city ?? existing.address.city,
      state: data.address?.state ?? existing.address.state,
      zipCode: data.address?.zipCode ?? existing.address.zipCode,
      fullAddress: data.address?.fullAddress ?? existing.address.fullAddress
    });

    const serializedAddresses = normalizeDoctorAddresses(primaryAddress, data.addresses ?? existing.addresses ?? []).map(entry => ({
      id: entry.id,
      label: entry.label ?? 'Endereço',
      isPrimary: entry.isPrimary,
      address: createPersistableAddress(entry.address)
    }));

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      coordinates: coordinates ?? null
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.crm !== undefined) updates.crm = data.crm;
    if (data.specialty !== undefined) updates.specialty = data.specialty;
    if (data.category !== undefined) updates.category = data.category;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.hasPanel !== undefined) updates.hasPanel = data.hasPanel;
    if (data.workingHours !== undefined) updates.workingHours = data.workingHours.map(wh => ({
      dayOfWeek: wh.dayOfWeek,
      addressId: wh.addressId ?? null,
      period: wh.period ?? null,
      specificTime: wh.specificTime ?? null,
      startTime: wh.startTime ?? null,
      endTime: wh.endTime ?? null,
    }));
    if (data.address !== undefined || data.addresses !== undefined) {
      updates.address = primaryAddress;
      updates.addresses = serializedAddresses;
    }

    await withTimeout(updateDoc(doc(db, 'users', user.id, 'doctors', id), updates));

    const updatedDoctor: Doctor = {
      ...existing,
      ...data,
      coordinates,
      updatedAt: new Date(),
      syncStatus: 'synced'
    };

    setDoctors(prev =>
      prev.map(d => d.id === id ? updatedDoctor : d).sort((a, b) => a.name.localeCompare(b.name))
    );
  };

  const deleteDoctor = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    await withTimeout(deleteDoc(doc(db, 'users', user.id, 'doctors', id)));
    setDoctors(prev => prev.filter(d => d.id !== id));
  };

  const getDoctor = async (id: string): Promise<Doctor | undefined> => {
    const local = doctors.find(d => d.id === id);
    if (local) return local;
    if (!user) return undefined;
    const snap = await withTimeout(getDoc(doc(db, 'users', user.id, 'doctors', id)));
    return snap.exists() ? mapDocToDoctor(snap.id, snap.data() as Record<string, unknown>) : undefined;
  };

  const searchDoctors = async (queryStr: string): Promise<Doctor[]> => {
    if (!queryStr.trim()) return doctors;
    const q = queryStr.toLowerCase().trim();
    return doctors.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.crm.toLowerCase().includes(q) ||
      d.specialty?.toLowerCase().includes(q) ||
      d.address.city.toLowerCase().includes(q)
    );
  };

  const importDoctorsFromCSV = async (csvContent: string): Promise<{ success: number; errors: string[] }> => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const errors: string[] = [];
    let success = 0;

    const dataLines = lines.slice(1);

    for (let i = 0; i < dataLines.length; i++) {
      const lineNum = i + 2;
      try {
        const columns = parseCSVLine(dataLines[i]);
        if (columns.length < 7) {
          errors.push(`Linha ${lineNum}: Número insuficiente de colunas`);
          continue;
        }

        const [name, crm, specialty, phone, email, addressStr, workingHoursStr] = columns;
        const addressParts = addressStr.split(',').map(s => s.trim());
        if (addressParts.length < 6) {
          errors.push(`Linha ${lineNum}: Formato de endereço inválido`);
          continue;
        }

        const address: Address = {
          street: addressParts[0],
          number: addressParts[1],
          neighborhood: addressParts[2],
          city: addressParts[3],
          state: addressParts[4],
          zipCode: addressParts[5]
        };

        const workingHours: WorkingHours[] = [];
        if (workingHoursStr) {
          for (const part of workingHoursStr.split(',')) {
            const match = part.match(/(\d):(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (match) {
              const startHour = parseInt(match[2].split(':')[0]);
              const period: AttendancePeriod = startHour < 12 ? 'M' : 'T';
              workingHours.push({ dayOfWeek: parseInt(match[1]), period, startTime: match[2], endTime: match[3] });
            }
          }
        }

        if (workingHours.length === 0) {
          for (let day = 1; day <= 5; day++) {
            workingHours.push({ dayOfWeek: day, period: 'M' as AttendancePeriod });
          }
        }

        await addDoctor({
          name: name.trim(), crm: crm.trim(),
          specialty: specialty?.trim() || undefined,
          phone: phone?.trim() || undefined,
          email: email?.trim() || undefined,
          address, workingHours
        });
        success++;
      } catch (err) {
        errors.push(`Linha ${lineNum}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    await loadDoctors();
    return { success, errors };
  };

  const markVisited = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const doctor = doctors.find(d => d.id === id);
    const now = new Date();
    const alreadyVisited = doctor?.lastVisitDate &&
      new Date(doctor.lastVisitDate).getFullYear() === now.getFullYear() &&
      new Date(doctor.lastVisitDate).getMonth() === now.getMonth();

    const newValue = alreadyVisited ? null : now.toISOString().split('T')[0];
    await updateDoc(doc(db, 'users', user.id, 'doctors', id), {
      lastVisitDate: newValue,
      updatedAt: now.toISOString()
    });
    setDoctors(prev =>
      prev.map(d => d.id === id
        ? { ...d, lastVisitDate: newValue ? new Date(newValue + 'T12:00:00') : undefined }
        : d
      )
    );
  };

  return {
    doctors, isLoading, error,
    addDoctor, updateDoctor, deleteDoctor, getDoctor,
    searchDoctors, importDoctorsFromCSV,
    refreshDoctors: loadDoctors,
    markVisited
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}
