import { useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDocs, addDoc, deleteDoc,
  query, orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface LocalHoliday {
  id: string;
  name: string;
  month: number; // 1–12
  day: number;
  city?: string;
  state?: string;
}

export function useLocalHolidays() {
  const { user } = useAuth();
  const [localHolidays, setLocalHolidays] = useState<LocalHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const ref = collection(db, 'users', user.id, 'localHolidays');
      const snap = await getDocs(query(ref, orderBy('month'), orderBy('day')));
      setLocalHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() } as LocalHoliday)));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const addLocalHoliday = useCallback(async (data: Omit<LocalHoliday, 'id'>) => {
    if (!user) return;
    const ref = collection(db, 'users', user.id, 'localHolidays');
    await addDoc(ref, data);
    await load();
  }, [user, load]);

  const deleteLocalHoliday = useCallback(async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.id, 'localHolidays', id));
    await load();
  }, [user, load]);

  return { localHolidays, isLoading, addLocalHoliday, deleteLocalHoliday };
}
