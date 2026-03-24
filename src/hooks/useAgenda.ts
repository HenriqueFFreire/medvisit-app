import { useState, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { startOfMonth, endOfMonth } from 'date-fns';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface AgendaSchedule {
  date: string;
  scheduleId: string;
  visitCount: number;
  status: string;
}

export function useAgenda() {
  const { user } = useAuth();
  const [monthSchedules, setMonthSchedules] = useState<AgendaSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMonth = useCallback(async (month: Date) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = endOfMonth(month).toISOString().split('T')[0];
      const q = query(
        collection(db, 'users', user.id, 'daily_schedules'),
        where('date', '>=', start),
        where('date', '<=', end),
        orderBy('date')
      );
      const snap = await getDocs(q);
      setMonthSchedules(snap.docs.map(d => ({
        date: d.data().date as string,
        scheduleId: d.id,
        visitCount: (d.data().visitCount as number) || 0,
        status: d.data().status as string,
      })));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return { monthSchedules, loadMonth, isLoading };
}
