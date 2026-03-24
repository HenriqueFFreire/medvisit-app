import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Visit, VisitStatus, SampleDelivery, Doctor, Address, WorkingHours } from '../types';

interface UseVisitsResult {
  visits: Visit[];
  isLoading: boolean;
  error: string | null;
  createVisit: (data: CreateVisitInput) => Promise<Visit>;
  updateVisit: (id: string, data: Partial<Visit>) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  getVisit: (id: string) => Promise<Visit | undefined>;
  getVisitsForDoctor: (doctorId: string) => Promise<Visit[]>;
  getVisitsForPeriod: (startDate: Date, endDate: Date) => Promise<Visit[]>;
  searchVisits: (query: string) => Promise<Visit[]>;
  refreshVisits: () => Promise<void>;
}

interface CreateVisitInput {
  doctorId: string;
  scheduledVisitId?: string;
  date: Date;
  startTime: string;
  endTime?: string;
  status: VisitStatus;
  reason?: string;
  notes?: string;
  productsPresented?: string[];
  samplesDelivered?: SampleDelivery[];
}

function mapDocToDoctor(id: string, data: Record<string, unknown>): Doctor {
  return {
    id,
    name: data.name as string,
    crm: data.crm as string,
    specialty: data.specialty as string | undefined,
    phone: data.phone as string | undefined,
    email: data.email as string | undefined,
    address: data.address as Address,
    coordinates: data.coordinates as Doctor['coordinates'],
    workingHours: (data.workingHours as WorkingHours[]) ?? [],
    notes: data.notes as string | undefined,
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
    syncStatus: 'synced'
  };
}

function mapDocToVisit(id: string, data: Record<string, unknown>, doctor?: Doctor): Visit {
  return {
    id,
    doctorId: data.doctorId as string,
    doctor,
    scheduledVisitId: data.scheduledVisitId as string | undefined,
    date: new Date(data.date as string),
    startTime: data.startTime as string,
    endTime: data.endTime as string | undefined,
    status: data.status as VisitStatus,
    reason: data.reason as string | undefined,
    notes: data.notes as string | undefined,
    productsPresented: (data.productsPresented as string[]) ?? [],
    samplesDelivered: (data.samplesDelivered as SampleDelivery[]) ?? [],
    createdAt: new Date(data.createdAt as string),
    updatedAt: new Date(data.updatedAt as string),
    syncStatus: 'synced'
  };
}

export function useVisits(): UseVisitsResult {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadDoctorById = async (uid: string, doctorId: string): Promise<Doctor | undefined> => {
    const snap = await getDoc(doc(db, 'users', uid, 'doctors', doctorId));
    return snap.exists() ? mapDocToDoctor(snap.id, snap.data() as Record<string, unknown>) : undefined;
  };

  const loadVisits = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users', user.id, 'visits'), orderBy('date', 'desc'));
      const snap = await getDocs(q);

      const doctorCache: Record<string, Doctor | undefined> = {};
      const visitList: Visit[] = [];

      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const doctorId = data.doctorId as string;
        if (!(doctorId in doctorCache)) {
          doctorCache[doctorId] = await loadDoctorById(user.id, doctorId);
        }
        visitList.push(mapDocToVisit(d.id, data, doctorCache[doctorId]));
      }

      setVisits(visitList);
      setError(null);
    } catch (err) {
      setError('Erro ao carregar visitas');
      console.error('Error loading visits:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  const createVisit = async (data: CreateVisitInput): Promise<Visit> => {
    if (!user) throw new Error('Usuário não autenticado');

    const now = new Date().toISOString();
    const dateStr = data.date.toISOString().split('T')[0];

    const visitData = {
      doctorId: data.doctorId,
      scheduledVisitId: data.scheduledVisitId ?? null,
      date: dateStr,
      startTime: data.startTime,
      endTime: data.endTime ?? null,
      status: data.status,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      productsPresented: data.productsPresented ?? [],
      samplesDelivered: data.samplesDelivered ?? [],
      createdAt: now,
      updatedAt: now
    };

    const ref = await addDoc(collection(db, 'users', user.id, 'visits'), visitData);

    // Update doctor's last visit date
    await updateDoc(doc(db, 'users', user.id, 'doctors', data.doctorId), {
      lastVisitDate: dateStr
    });

    // Update scheduled visit status if applicable
    if (data.scheduledVisitId) {
      await updateDoc(doc(db, 'users', user.id, 'scheduled_visits', data.scheduledVisitId), {
        status: data.status,
        actualStartTime: data.startTime,
        actualEndTime: data.endTime ?? null
      });
    }

    const doctor = await loadDoctorById(user.id, data.doctorId);
    const newVisit = mapDocToVisit(ref.id, visitData as Record<string, unknown>, doctor);
    setVisits(prev => [newVisit, ...prev]);
    return newVisit;
  };

  const updateVisit = async (id: string, data: Partial<Visit>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.status !== undefined) updates.status = data.status;
    if (data.endTime !== undefined) updates.endTime = data.endTime;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.reason !== undefined) updates.reason = data.reason;
    if (data.productsPresented !== undefined) updates.productsPresented = data.productsPresented;
    if (data.samplesDelivered !== undefined) updates.samplesDelivered = data.samplesDelivered;

    await updateDoc(doc(db, 'users', user.id, 'visits', id), updates);
    setVisits(prev => prev.map(v => v.id === id ? { ...v, ...data, updatedAt: new Date() } : v));
  };

  const deleteVisit = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    await deleteDoc(doc(db, 'users', user.id, 'visits', id));
    setVisits(prev => prev.filter(v => v.id !== id));
  };

  const getVisit = async (id: string): Promise<Visit | undefined> => {
    const local = visits.find(v => v.id === id);
    if (local) return local;
    if (!user) return undefined;
    const snap = await getDoc(doc(db, 'users', user.id, 'visits', id));
    if (!snap.exists()) return undefined;
    const data = snap.data() as Record<string, unknown>;
    const doctor = await loadDoctorById(user.id, data.doctorId as string);
    return mapDocToVisit(snap.id, data, doctor);
  };

  const getVisitsForDoctor = async (doctorId: string): Promise<Visit[]> => {
    if (!user) return [];
    const q = query(
      collection(db, 'users', user.id, 'visits'),
      where('doctorId', '==', doctorId),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    const doctor = await loadDoctorById(user.id, doctorId);
    return snap.docs.map(d => mapDocToVisit(d.id, d.data() as Record<string, unknown>, doctor));
  };

  const getVisitsForPeriod = async (startDate: Date, endDate: Date): Promise<Visit[]> => {
    if (!user) return [];
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const q = query(
      collection(db, 'users', user.id, 'visits'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    const doctorCache: Record<string, Doctor | undefined> = {};
    const result: Visit[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const doctorId = data.doctorId as string;
      if (!(doctorId in doctorCache)) {
        doctorCache[doctorId] = await loadDoctorById(user.id, doctorId);
      }
      result.push(mapDocToVisit(d.id, data, doctorCache[doctorId]));
    }
    return result;
  };

  const searchVisits = async (queryStr: string): Promise<Visit[]> => {
    if (!queryStr.trim()) return visits;
    const q = queryStr.toLowerCase().trim();
    return visits.filter(v =>
      v.doctor?.name.toLowerCase().includes(q) ||
      v.notes?.toLowerCase().includes(q) ||
      v.productsPresented?.some(p => p.toLowerCase().includes(q))
    );
  };

  return {
    visits, isLoading, error,
    createVisit, updateVisit, deleteVisit, getVisit,
    getVisitsForDoctor, getVisitsForPeriod, searchVisits,
    refreshVisits: loadVisits
  };
}
