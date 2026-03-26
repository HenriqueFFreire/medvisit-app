import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { geocodeAddress } from '../services/geocoding';
import type { Pharmacy, Address } from '../types';

interface UsePharmaciesResult {
  pharmacies: Pharmacy[];
  isLoading: boolean;
  addPharmacy: (data: PharmacyInput) => Promise<Pharmacy>;
  updatePharmacy: (id: string, data: Partial<PharmacyInput>) => Promise<void>;
  deletePharmacy: (id: string) => Promise<void>;
  refreshPharmacies: () => Promise<void>;
}

export interface PharmacyInput {
  name: string;
  phone?: string;
  address: Address;
  notes?: string;
}

function mapToPharmacy(id: string, data: Record<string, unknown>): Pharmacy {
  return {
    id,
    name: data.name as string,
    phone: data.phone as string | undefined,
    address: data.address as Address,
    coordinates: data.coordinates as Pharmacy['coordinates'],
    notes: data.notes as string | undefined,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
    syncStatus: 'synced',
    lastRoutedDate: data.lastRoutedDate ? new Date(data.lastRoutedDate as string) : undefined,
  };
}

export function usePharmacies(): UsePharmaciesResult {
  const { user } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPharmacies = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users', user.id, 'pharmacies'), orderBy('name'));
      const snap = await getDocs(q);
      setPharmacies(snap.docs.map(d => mapToPharmacy(d.id, d.data() as Record<string, unknown>)));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPharmacies(); }, [fetchPharmacies]);

  const addPharmacy = async (data: PharmacyInput): Promise<Pharmacy> => {
    if (!user) throw new Error('Usuário não autenticado');
    const now = new Date().toISOString();

    let coordinates: Pharmacy['coordinates'] = undefined;
    try {
      const coords = await geocodeAddress(data.address);
      if (coords) coordinates = coords;
    } catch {}

    const docData = {
      name: data.name,
      phone: data.phone ?? null,
      address: data.address,
      coordinates: coordinates ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await addDoc(collection(db, 'users', user.id, 'pharmacies'), docData);
    const pharmacy = mapToPharmacy(ref.id, { ...docData, id: ref.id });
    setPharmacies(prev => [...prev, pharmacy].sort((a, b) => a.name.localeCompare(b.name)));
    return pharmacy;
  };

  const updatePharmacy = async (id: string, data: Partial<PharmacyInput>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const updates: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };

    if (data.address) {
      try {
        const coords = await geocodeAddress(data.address);
        if (coords) updates.coordinates = coords;
      } catch {}
    }

    await updateDoc(doc(db, 'users', user.id, 'pharmacies', id), updates);
    await fetchPharmacies();
  };

  const deletePharmacy = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    await deleteDoc(doc(db, 'users', user.id, 'pharmacies', id));
    setPharmacies(prev => prev.filter(p => p.id !== id));
  };

  return {
    pharmacies,
    isLoading,
    addPharmacy,
    updatePharmacy,
    deletePharmacy,
    refreshPharmacies: fetchPharmacies,
  };
}
