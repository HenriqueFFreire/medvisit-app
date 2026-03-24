import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, isWithinInterval, startOfDay } from 'date-fns';
import {
  collection, doc, getDocs, getDoc, updateDoc,
  query, orderBy, where, writeBatch, DocumentReference
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateScheduleFromDoctors, calculateRouteStats, insertDoctorOptimized, type WeeklyRouteDistribution } from '../services/routing';
import type { Route, RouteType, DailySchedule, ScheduledVisit, RouteStatus, DayStatus, Doctor, Address, WorkingHours } from '../types';
import { useApp } from '../contexts/AppContext';

interface RescheduledVisitInfo {
  doctor: Doctor;
  newDate: Date;
  newScheduleId: string;
}

interface FinishDayResult {
  rescheduledCount: number;
  rescheduledVisits: RescheduledVisitInfo[];
  completedCount: number;
  notDoneCount: number;
}

interface UseRoutesResult {
  routes: Route[];
  currentRoute: Route | null;
  todaySchedule: DailySchedule | null;
  isLoading: boolean;
  error: string | null;
  createRoute: (data: CreateRouteInput) => Promise<Route>;
  updateRoute: (id: string, data: Partial<Route>) => Promise<void>;
  deleteRoute: (id: string) => Promise<void>;
  duplicateRoute: (routeId: string, newStartDate: Date) => Promise<Route>;
  getRoute: (id: string) => Promise<Route | undefined>;
  getRouteForDate: (date: Date) => Promise<Route | null>;
  getDailySchedule: (routeId: string, date: Date) => Promise<DailySchedule | null>;
  updateScheduledVisit: (visitId: string, updates: Partial<ScheduledVisit>) => Promise<void>;
  moveVisitToDay: (visitId: string, targetDateStr: string) => Promise<void>;
  refreshRoutes: () => Promise<void>;
  findNextAvailableDay: (doctorId: string, afterDate: Date) => Promise<DailySchedule | null>;
  rescheduleVisit: (visitId: string, targetScheduleId: string) => Promise<void>;
  finishDayAndReschedule: (scheduleId: string) => Promise<FinishDayResult>;
  getMonthSchedules: (month: Date) => Promise<{ date: string; scheduleId: string; visitCount: number; status: string }[]>;
  getRouteSchedules: (routeId: string) => Promise<DailySchedule[]>;
}

interface CreateRouteInput {
  name?: string;
  routeType: RouteType;
  startDate: Date;
  visitsPerDay: number;
  visitDuration: number;
  doctorIds: string[];
  weeklyDistribution?: WeeklyRouteDistribution;
  multiWeekDistributions?: WeeklyRouteDistribution[]; // one per week, for multi-week routes
  numberOfWeeks?: number;    // 1..5, week type only
  selectedDays?: number[];   // 1=Mon..5=Fri, default all 5
  selectedWeeks?: number[];  // 1..5 (week of month), default all
  excludedDates?: string[];
  excludedMornings?: string[];   // dates where morning shift (M) is excluded
  excludedAfternoons?: string[]; // dates where afternoon shift (T) is excluded
  // Preview-confirmed assignment: overrides distribution logic when provided
  perDateAssignment?: { dateStr: string; panelDoctorIds: string[]; suggestionDoctorIds: string[] }[];
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
    syncStatus: 'synced',
    lastVisitDate: data.lastVisitDate ? new Date(data.lastVisitDate as string) : undefined,
    lastRoutedDate: data.lastRoutedDate ? new Date(data.lastRoutedDate as string) : undefined,
  };
}

async function loadDoctorById(uid: string, doctorId: string): Promise<Doctor | undefined> {
  const snap = await getDoc(doc(db, 'users', uid, 'doctors', doctorId));
  return snap.exists() ? mapDocToDoctor(snap.id, snap.data() as Record<string, unknown>) : undefined;
}

async function loadScheduleWithVisits(uid: string, scheduleId: string, scheduleData: Record<string, unknown>): Promise<DailySchedule> {
  const q = query(
    collection(db, 'users', uid, 'scheduled_visits'),
    where('dailyScheduleId', '==', scheduleId)
  );
  const snap = await getDocs(q);

  const doctorIds = [...new Set(snap.docs.map(d => d.data().doctorId as string))];
  const doctorMap: Record<string, Doctor | undefined> = {};
  await Promise.all(doctorIds.map(async id => {
    doctorMap[id] = await loadDoctorById(uid, id);
  }));

  const visits: ScheduledVisit[] = snap.docs.sort((a, b) => (a.data().order as number) - (b.data().order as number)).map(d => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      dailyScheduleId: data.dailyScheduleId as string,
      doctorId: data.doctorId as string,
      doctor: doctorMap[data.doctorId as string],
      order: data.order as number,
      scheduledTime: data.scheduledTime as string,
      estimatedEndTime: data.estimatedEndTime as string,
      estimatedTravelTime: data.estimatedTravelTime as number | undefined,
      estimatedDistance: data.estimatedDistance as number | undefined,
      status: data.status as ScheduledVisit['status'],
      actualStartTime: data.actualStartTime as string | undefined,
      actualEndTime: data.actualEndTime as string | undefined,
      rescheduledFromId: data.rescheduledFromId as string | undefined,
      rescheduledToId: data.rescheduledToId as string | undefined,
      isSuggestion: (data.isSuggestion as boolean) || false,
      rescheduledFromDate: data.rescheduledFromDate ? new Date(data.rescheduledFromDate as string) : undefined
    };
  });

  return {
    id: scheduleId,
    routeId: scheduleData.routeId as string,
    date: new Date(scheduleData.date as string),
    dayOfWeek: scheduleData.dayOfWeek as number,
    visits,
    totalDistance: scheduleData.totalDistance as number | undefined,
    totalTime: scheduleData.totalTime as number | undefined,
    status: scheduleData.status as DayStatus
  };
}

export function useRoutes(): UseRoutesResult {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<DailySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { settings } = useApp();

  const loadRoutes = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users', user.id, 'routes'), orderBy('weekStartDate', 'desc'));
      const snap = await getDocs(q);

      const allRoutes: Route[] = snap.docs.map(d => {
        const r = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: r.name as string | undefined,
          routeType: (r.routeType as RouteType) || 'week',
          weekStartDate: new Date(r.weekStartDate as string),
          weekEndDate: new Date(r.weekEndDate as string),
          visitsPerDay: r.visitsPerDay as number,
          visitDuration: r.visitDuration as number,
          totalDistance: r.totalDistance as number | undefined,
          totalTime: r.totalTime as number | undefined,
          status: r.status as RouteStatus,
          dailySchedules: [],
          createdAt: new Date(r.createdAt as string),
          updatedAt: new Date(r.updatedAt as string),
          syncStatus: 'synced'
        };
      });

      setRoutes(allRoutes);

      const today = new Date();
      const currentWeekRoute = allRoutes.find(r =>
        isWithinInterval(today, { start: r.weekStartDate, end: r.weekEndDate })
      );
      setCurrentRoute(currentWeekRoute || null);

      if (currentWeekRoute) {
        const todayStr = startOfDay(today).toISOString().split('T')[0];
        const schedQ = query(
          collection(db, 'users', user.id, 'daily_schedules'),
          where('routeId', '==', currentWeekRoute.id),
          where('date', '==', todayStr)
        );
        const schedSnap = await getDocs(schedQ);
        if (!schedSnap.empty) {
          const schedDoc = schedSnap.docs[0];
          const schedule = await loadScheduleWithVisits(user.id, schedDoc.id, schedDoc.data() as Record<string, unknown>);
          setTodaySchedule(schedule);
        } else {
          setTodaySchedule(null);
        }
      } else {
        setTodaySchedule(null);
      }

      setError(null);
    } catch (err) {
      setError('Erro ao carregar roteiros');
      console.error('Error loading routes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const createRoute = async (data: CreateRouteInput): Promise<Route> => {
    if (!user) throw new Error('Usuário não autenticado');

    // Load selected doctors
    const allDoctors: Doctor[] = [];
    await Promise.all(data.doctorIds.map(async id => {
      const doctor = await loadDoctorById(user.id, id);
      if (doctor) allDoctors.push(doctor);
    }));

    // Separate panel doctors (count toward visitsPerDay) from suggestions (hasPanel === false)
    const panelDoctors = allDoctors.filter(d => d.hasPanel !== false);
    const suggestionDoctors = allDoctors.filter(d => d.hasPanel === false);

    interface ScheduleEntry { date: Date; dayOfWeek: number; totalDistance?: number; totalTime?: number; }
    const dailySchedulesData: ScheduleEntry[] = [];
    const allVisitsData: (Omit<ScheduledVisit, 'doctor'> & { tempScheduleIndex: number })[] = [];
    let totalDistance = 0;
    let totalTime = 0;
    let routeStart: Date;
    let routeEnd: Date;

    const wStart = settings?.workStartTime || '07:00';
    const wEnd = settings?.workEndTime || '19:00';
    const minInterval = settings?.minimumInterval || 15;

    const addDay = (date: Date, dayOfWeek: number, dayPanelDoctors: Doctor[], daySuggestionDoctors: Doctor[]) => {
      // Panel doctors fill visitsPerDay slots
      const panelVisits = generateScheduleFromDoctors(dayPanelDoctors, date, data.visitDuration, wStart, wEnd, minInterval);
      // Suggestion doctors get scheduled after (ignoring visitsPerDay limit)
      const suggestionVisits = generateScheduleFromDoctors(daySuggestionDoctors, date, data.visitDuration, wStart, wEnd, minInterval);
      const stats = calculateRouteStats(panelVisits);
      totalDistance += stats.totalDistance;
      totalTime += stats.totalTime;
      const idx = dailySchedulesData.length;
      dailySchedulesData.push({ date, dayOfWeek, totalDistance: stats.totalDistance, totalTime: stats.totalTime });
      panelVisits.forEach(v => allVisitsData.push({ ...v, id: '', dailyScheduleId: '', isSuggestion: false, tempScheduleIndex: idx }));
      suggestionVisits.forEach(v => allVisitsData.push({ ...v, id: '', dailyScheduleId: '', isSuggestion: true, tempScheduleIndex: idx }));
    };

    const activeDays = data.selectedDays ?? [1, 2, 3, 4, 5];

    // Returns 1-based week-of-month (Mon=start) for a date
    const weekOfMonth = (d: Date): number => {
      const firstMonday = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
      const diff = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 86400000));
      return diff + 1;
    };

    // Apply morning/afternoon shift exclusions to a doctor list for a given date
    const applyShiftExclusions = (dayDoctors: Doctor[], dateStr: string, dow: number): Doctor[] => {
      let filtered = dayDoctors;
      if (data.excludedMornings?.includes(dateStr)) {
        // Remove doctors who attend ONLY in the morning on this day
        filtered = filtered.filter(d => {
          const wh = d.workingHours.find(w => w.dayOfWeek === dow);
          return !wh || wh.period !== 'M';
        });
      }
      if (data.excludedAfternoons?.includes(dateStr)) {
        // Remove doctors who attend ONLY in the afternoon on this day
        filtered = filtered.filter(d => {
          const wh = d.workingHours.find(w => w.dayOfWeek === dow);
          return !wh || wh.period !== 'T';
        });
      }
      return filtered;
    };

    if (data.perDateAssignment && data.perDateAssignment.length > 0) {
      const sorted = [...data.perDateAssignment].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      routeStart = new Date(sorted[0].dateStr + 'T12:00:00');
      routeEnd = new Date(sorted[sorted.length - 1].dateStr + 'T12:00:00');
      for (const day of sorted) {
        const date = new Date(day.dateStr + 'T12:00:00');
        const dow = date.getDay();
        const dayPanel = allDoctors.filter(d => day.panelDoctorIds.includes(d.id));
        const daySuggestions = allDoctors.filter(d => day.suggestionDoctorIds.includes(d.id));
        if (dayPanel.length > 0 || daySuggestions.length > 0)
          addDay(date, dow, dayPanel, daySuggestions);
      }
    } else if (data.routeType === 'day') {
      routeStart = data.startDate;
      routeEnd = data.startDate;
      const dateStr = data.startDate.toISOString().split('T')[0];
      const dow = data.startDate.getDay();
      if (!data.excludedDates?.includes(dateStr)) {
        const dayPanel = applyShiftExclusions(panelDoctors, dateStr, dow);
        const daySuggestions = applyShiftExclusions(suggestionDoctors, dateStr, dow);
        if (dayPanel.length > 0 || daySuggestions.length > 0)
          addDay(data.startDate, dow, dayPanel, daySuggestions);
      }

    } else if (data.routeType === 'week') {
      const numWeeks = data.numberOfWeeks ?? 1;
      routeStart = startOfWeek(data.startDate, { weekStartsOn: 1 });
      routeEnd = endOfWeek(addDays(routeStart, (numWeeks - 1) * 7), { weekStartsOn: 1 });
      for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
        const weekStart = addDays(routeStart, weekIdx * 7);
        const weekDistrib = data.multiWeekDistributions?.[weekIdx] ?? data.weeklyDistribution;
        for (let i = 0; i < 5; i++) {
          const date = addDays(weekStart, i);
          const dow = date.getDay();
          if (!activeDays.includes(dow)) continue;
          const dateStr = date.toISOString().split('T')[0];
          if (!data.excludedDates?.includes(dateStr)) {
            const basePanel = weekDistrib?.[dow] || panelDoctors;
            const dayPanel = applyShiftExclusions(basePanel, dateStr, dow);
            const daySuggestions = applyShiftExclusions(suggestionDoctors, dateStr, dow);
            if (dayPanel.length > 0 || daySuggestions.length > 0)
              addDay(date, dow, dayPanel, daySuggestions);
          }
        }
      }

    } else { // month
      const monthStart = startOfMonth(data.startDate);
      const monthEnd = endOfMonth(data.startDate);
      routeStart = monthStart;
      routeEnd = monthEnd;
      const activeWeeks = data.selectedWeeks ?? [1, 2, 3, 4, 5];
      let current = monthStart;
      while (current <= monthEnd) {
        const dow = current.getDay();
        if (dow >= 1 && dow <= 5 && activeDays.includes(dow) && activeWeeks.includes(weekOfMonth(current))) {
          const dateStr = current.toISOString().split('T')[0];
          if (!data.excludedDates?.includes(dateStr)) {
            const basePanel = data.weeklyDistribution?.[dow] || panelDoctors;
            const dayPanel = applyShiftExclusions(basePanel, dateStr, dow);
            const daySuggestions = applyShiftExclusions(suggestionDoctors, dateStr, dow);
            if (dayPanel.length > 0 || daySuggestions.length > 0)
              addDay(current, dow, dayPanel, daySuggestions);
          }
        }
        current = addDays(current, 1);
      }
    }

    // Write in batches of 499 (Firestore limit is 500)
    const now = new Date().toISOString();
    const routeRef = doc(collection(db, 'users', user.id, 'routes'));
    const routeData = {
      ...(data.name ? { name: data.name } : {}),
      routeType: data.routeType,
      weekStartDate: routeStart.toISOString().split('T')[0],
      weekEndDate: routeEnd.toISOString().split('T')[0],
      visitsPerDay: data.visitsPerDay,
      visitDuration: data.visitDuration,
      totalDistance,
      totalTime,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now
    };

    interface WriteOp { ref: DocumentReference; data: Record<string, unknown>; }
    const writes: WriteOp[] = [{ ref: routeRef, data: routeData }];

    const scheduleRefs: string[] = [];
    for (let i = 0; i < dailySchedulesData.length; i++) {
      const sched = dailySchedulesData[i];
      const schedRef = doc(collection(db, 'users', user.id, 'daily_schedules'));
      scheduleRefs.push(schedRef.id);
      writes.push({ ref: schedRef, data: {
        routeId: routeRef.id,
        date: sched.date.toISOString().split('T')[0],
        dayOfWeek: sched.dayOfWeek,
        totalDistance: sched.totalDistance ?? 0,
        totalTime: sched.totalTime ?? 0,
        status: 'pending',
        visitCount: allVisitsData.filter(v => v.tempScheduleIndex === i && !v.isSuggestion).length,
        suggestionCount: allVisitsData.filter(v => v.tempScheduleIndex === i && v.isSuggestion).length
      }});
    }

    for (const visit of allVisitsData) {
      const visitRef = doc(collection(db, 'users', user.id, 'scheduled_visits'));
      writes.push({ ref: visitRef, data: {
        dailyScheduleId: scheduleRefs[visit.tempScheduleIndex],
        doctorId: visit.doctorId,
        order: visit.order,
        scheduledTime: visit.scheduledTime,
        estimatedEndTime: visit.estimatedEndTime,
        estimatedTravelTime: visit.estimatedTravelTime ?? null,
        estimatedDistance: visit.estimatedDistance ?? null,
        isSuggestion: visit.isSuggestion ?? false,
        status: 'pending',
        actualStartTime: null,
        actualEndTime: null,
        rescheduledFromId: null,
        rescheduledToId: null,
        rescheduledFromDate: null
      }});
    }

    const BATCH_SIZE = 499;
    for (let i = 0; i < writes.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      writes.slice(i, i + BATCH_SIZE).forEach(w => batch.set(w.ref, w.data));
      await batch.commit();
    }

    // Update lastRoutedDate on all doctors in this route
    const today = now.split('T')[0];
    const doctorUpdateBatch = writeBatch(db);
    for (const doctorId of data.doctorIds) {
      doctorUpdateBatch.update(doc(db, 'users', user.id, 'doctors', doctorId), {
        lastRoutedDate: today,
        updatedAt: now
      });
    }
    await doctorUpdateBatch.commit();

    await loadRoutes();

    return {
      id: routeRef.id,
      routeType: data.routeType,
      weekStartDate: routeStart,
      weekEndDate: routeEnd,
      visitsPerDay: data.visitsPerDay,
      visitDuration: data.visitDuration,
      totalDistance,
      totalTime,
      status: 'confirmed' as RouteStatus,
      dailySchedules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'synced'
    };
  };

  const updateRoute = async (id: string, data: Partial<Route>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.status !== undefined) updates.status = data.status;
    if (data.visitsPerDay !== undefined) updates.visitsPerDay = data.visitsPerDay;
    if (data.visitDuration !== undefined) updates.visitDuration = data.visitDuration;
    await updateDoc(doc(db, 'users', user.id, 'routes', id), updates);
    await loadRoutes();
  };

  const deleteRoute = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    // Load and delete scheduled_visits and daily_schedules first
    const batch = writeBatch(db);

    const schedulesQ = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('routeId', '==', id)
    );
    const schedSnap = await getDocs(schedulesQ);

    for (const schedDoc of schedSnap.docs) {
      const visitsQ = query(
        collection(db, 'users', user.id, 'scheduled_visits'),
        where('dailyScheduleId', '==', schedDoc.id)
      );
      const visitsSnap = await getDocs(visitsQ);
      visitsSnap.docs.forEach(v => batch.delete(v.ref));
      batch.delete(schedDoc.ref);
    }

    batch.delete(doc(db, 'users', user.id, 'routes', id));
    await batch.commit();
    await loadRoutes();
  };

  const duplicateRoute = async (routeId: string, newStartDate: Date): Promise<Route> => {
    if (!user) throw new Error('Usuário não autenticado');

    // Load the original route
    const routeSnap = await getDoc(doc(db, 'users', user.id, 'routes', routeId));
    if (!routeSnap.exists()) throw new Error('Roteiro não encontrado');
    const routeData = routeSnap.data() as Record<string, unknown>;

    // Load all daily schedules of this route
    const schedQ = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('routeId', '==', routeId)
    );
    const schedSnap = await getDocs(schedQ);

    // Rebuild distribution by dayOfWeek (respecting original order)
    const distribution: WeeklyRouteDistribution = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    const allDoctorIds = new Set<string>();

    for (const schedDoc of schedSnap.docs) {
      const dow = schedDoc.data().dayOfWeek as number;
      if (dow < 1 || dow > 5) continue;

      const visitsQ = query(
        collection(db, 'users', user.id, 'scheduled_visits'),
        where('dailyScheduleId', '==', schedDoc.id)
      );
      const visitsSnap = await getDocs(visitsQ);
      const sorted = visitsSnap.docs.sort((a, b) => (a.data().order as number) - (b.data().order as number));

      const dayDoctors: Doctor[] = [];
      for (const vDoc of sorted) {
        const doctorId = vDoc.data().doctorId as string;
        allDoctorIds.add(doctorId);
        const doctor = await loadDoctorById(user.id, doctorId);
        if (doctor) dayDoctors.push(doctor);
      }
      // merge: a route may span multiple weeks — keep unique doctors per day
      if (distribution[dow].length === 0) distribution[dow] = dayDoctors;
    }

    return createRoute({
      routeType: routeData.routeType as RouteType,
      startDate: newStartDate,
      visitsPerDay: routeData.visitsPerDay as number,
      visitDuration: routeData.visitDuration as number,
      doctorIds: [...allDoctorIds],
      weeklyDistribution: distribution,
    });
  };

  const getRoute = async (id: string): Promise<Route | undefined> => {
    return routes.find(r => r.id === id);
  };

  const getRouteForDate = async (date: Date): Promise<Route | null> => {
    return routes.find(r =>
      isWithinInterval(date, { start: r.weekStartDate, end: r.weekEndDate })
    ) || null;
  };

  const getDailySchedule = useCallback(async (routeId: string, date: Date): Promise<DailySchedule | null> => {
    if (!user) return null;
    const dateStr = startOfDay(date).toISOString().split('T')[0];
    const q = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('routeId', '==', routeId),
      where('date', '==', dateStr)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const schedDoc = snap.docs[0];
    return loadScheduleWithVisits(user.id, schedDoc.id, schedDoc.data() as Record<string, unknown>);
  }, [user]);

  const updateScheduledVisit = async (visitId: string, updates: Partial<ScheduledVisit>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const row: Record<string, unknown> = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.actualStartTime !== undefined) row.actualStartTime = updates.actualStartTime;
    if (updates.actualEndTime !== undefined) row.actualEndTime = updates.actualEndTime;
    if (updates.rescheduledToId !== undefined) row.rescheduledToId = updates.rescheduledToId;
    if (updates.rescheduledFromId !== undefined) row.rescheduledFromId = updates.rescheduledFromId;
    if (updates.rescheduledFromDate !== undefined) row.rescheduledFromDate = (updates.rescheduledFromDate as Date).toISOString().split('T')[0];
    await updateDoc(doc(db, 'users', user.id, 'scheduled_visits', visitId), row);
    await loadRoutes();
  };

  const findNextAvailableDay = async (doctorId: string, afterDate: Date): Promise<DailySchedule | null> => {
    if (!user) return null;

    const doctorSnap = await getDoc(doc(db, 'users', user.id, 'doctors', doctorId));
    if (!doctorSnap.exists()) return null;

    const workingDays = ((doctorSnap.data().workingHours ?? []) as Array<{ dayOfWeek: number }>).map(wh => wh.dayOfWeek);
    if (workingDays.length === 0) return null;

    const afterDateStr = afterDate.toISOString().split('T')[0];

    const q = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('date', '>', afterDateStr),
      orderBy('date')
    );
    const snap = await getDocs(q);

    for (const schedDoc of snap.docs) {
      const data = schedDoc.data() as Record<string, unknown>;
      if (data.status === 'completed') continue;

      const scheduleDate = new Date(data.date as string);
      const dayOfWeek = scheduleDate.getDay();
      if (!workingDays.includes(dayOfWeek)) continue;

      // Find the route to get visitsPerDay
      const routeSnap = await getDoc(doc(db, 'users', user.id, 'routes', data.routeId as string));
      if (!routeSnap.exists()) continue;
      const visitsPerDay = routeSnap.data().visitsPerDay as number;

      // Count existing visits
      const visitsQ = query(
        collection(db, 'users', user.id, 'scheduled_visits'),
        where('dailyScheduleId', '==', schedDoc.id)
      );
      const visitsSnap = await getDocs(visitsQ);

      if (visitsSnap.size < visitsPerDay) {
        return {
          id: schedDoc.id,
          routeId: data.routeId as string,
          date: scheduleDate,
          dayOfWeek: data.dayOfWeek as number,
          visits: [],
          totalDistance: data.totalDistance as number | undefined,
          totalTime: data.totalTime as number | undefined,
          status: data.status as DayStatus
        };
      }
    }

    return null;
  };

  const rescheduleVisit = async (visitId: string, targetScheduleId: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');

    const originalVisitSnap = await getDoc(doc(db, 'users', user.id, 'scheduled_visits', visitId));
    if (!originalVisitSnap.exists()) throw new Error('Visita não encontrada');
    const originalVisit = originalVisitSnap.data() as Record<string, unknown>;

    const targetScheduleSnap = await getDoc(doc(db, 'users', user.id, 'daily_schedules', targetScheduleId));
    if (!targetScheduleSnap.exists()) throw new Error('Agenda de destino não encontrada');
    const targetSchedule = targetScheduleSnap.data() as Record<string, unknown>;

    const routeSnap = await getDoc(doc(db, 'users', user.id, 'routes', targetSchedule.routeId as string));
    const visitDuration = routeSnap.exists() ? (routeSnap.data().visitDuration as number) : 10;

    const doctor = await loadDoctorById(user.id, originalVisit.doctorId as string);
    if (!doctor) throw new Error('Médico não encontrado');

    // Get existing visits in target day
    const existingQ = query(
      collection(db, 'users', user.id, 'scheduled_visits'),
      where('dailyScheduleId', '==', targetScheduleId)
    );
    const existingSnap = await getDocs(existingQ);
    const existingDoctorIds = [...new Set(existingSnap.docs.map(d => d.data().doctorId as string))];

    const existingDoctors: Doctor[] = [];
    await Promise.all(existingDoctorIds.map(async id => {
      const d = await loadDoctorById(user.id, id);
      if (d) existingDoctors.push(d);
    }));

    const optimizedDoctors = insertDoctorOptimized(existingDoctors, doctor);
    const newVisits = generateScheduleFromDoctors(
      optimizedDoctors,
      new Date(targetSchedule.date as string),
      visitDuration,
      settings?.workStartTime || '07:00',
      settings?.workEndTime || '19:00',
      settings?.minimumInterval || 15
    );

    // Get original schedule date
    const originalScheduleSnap = await getDoc(doc(db, 'users', user.id, 'daily_schedules', originalVisit.dailyScheduleId as string));
    const originalScheduleDate = originalScheduleSnap.exists()
      ? (originalScheduleSnap.data().date as string)
      : null;

    const newVisitId = crypto.randomUUID();

    const batch = writeBatch(db);

    // Mark original as rescheduled
    batch.update(doc(db, 'users', user.id, 'scheduled_visits', visitId), {
      status: 'rescheduled',
      rescheduledToId: newVisitId
    });

    // Delete existing visits in target day
    existingSnap.docs.forEach(d => batch.delete(d.ref));

    // Insert new visits
    for (const v of newVisits) {
      const id = v.doctorId === doctor.id ? newVisitId : crypto.randomUUID();
      const visitRef = doc(db, 'users', user.id, 'scheduled_visits', id);
      batch.set(visitRef, {
        dailyScheduleId: targetScheduleId,
        doctorId: v.doctorId,
        order: v.order,
        scheduledTime: v.scheduledTime,
        estimatedEndTime: v.estimatedEndTime,
        estimatedTravelTime: v.estimatedTravelTime ?? null,
        estimatedDistance: v.estimatedDistance ?? null,
        status: 'pending',
        actualStartTime: null,
        actualEndTime: null,
        rescheduledFromId: v.doctorId === doctor.id ? visitId : null,
        rescheduledToId: null,
        rescheduledFromDate: v.doctorId === doctor.id && originalScheduleDate ? originalScheduleDate : null
      });
    }

    // Update target schedule stats
    const stats = calculateRouteStats(newVisits);
    batch.update(doc(db, 'users', user.id, 'daily_schedules', targetScheduleId), {
      totalDistance: stats.totalDistance,
      totalTime: stats.totalTime
    });

    await batch.commit();
    await loadRoutes();
  };

  const finishDayAndReschedule = async (scheduleId: string): Promise<FinishDayResult> => {
    if (!user) throw new Error('Usuário não autenticado');

    const schedSnap = await getDoc(doc(db, 'users', user.id, 'daily_schedules', scheduleId));
    if (!schedSnap.exists()) throw new Error('Agenda não encontrada');

    const visitsQ = query(
      collection(db, 'users', user.id, 'scheduled_visits'),
      where('dailyScheduleId', '==', scheduleId)
    );
    const visitsSnap = await getDocs(visitsQ);
    interface VisitRow { id: string; status: string; doctorId: string; }
    const allVisits: VisitRow[] = visitsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<VisitRow, 'id'>) }));

    const completedVisits = allVisits.filter(v => v.status === 'completed');
    const notDoneVisits = allVisits.filter(v => v.status === 'not_done');
    const pendingVisits = allVisits.filter(v => v.status === 'pending' || v.status === 'in_progress');

    const visitsToReschedule = [...pendingVisits, ...notDoneVisits];
    const rescheduledVisits: RescheduledVisitInfo[] = [];

    for (const visit of visitsToReschedule) {
      const doctor = await loadDoctorById(user.id, visit.doctorId as string);
      if (!doctor) continue;

      const schedData = schedSnap.data() as Record<string, unknown>;
      const nextDay = await findNextAvailableDay(visit.doctorId as string, new Date(schedData.date as string));

      if (nextDay) {
        await rescheduleVisit(visit.id, nextDay.id);
        rescheduledVisits.push({ doctor, newDate: nextDay.date, newScheduleId: nextDay.id });
      } else {
        await updateDoc(doc(db, 'users', user.id, 'scheduled_visits', visit.id), { status: 'not_done' });
      }
    }

    await updateDoc(doc(db, 'users', user.id, 'daily_schedules', scheduleId), { status: 'completed' });
    await loadRoutes();

    return {
      rescheduledCount: rescheduledVisits.length,
      rescheduledVisits,
      completedCount: completedVisits.length,
      notDoneCount: notDoneVisits.length
    };
  };

  const getMonthSchedules = useCallback(async (month: Date): Promise<{ date: string; scheduleId: string; visitCount: number; status: string }[]> => {
    if (!user) return [];
    const start = startOfMonth(month).toISOString().split('T')[0];
    const end = endOfMonth(month).toISOString().split('T')[0];
    const q = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('date', '>=', start),
      where('date', '<=', end),
      orderBy('date')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      date: d.data().date as string,
      scheduleId: d.id,
      visitCount: (d.data().visitCount as number) || 0,
      status: d.data().status as string,
    }));
  }, [user]);

  const getRouteSchedules = useCallback(async (routeId: string): Promise<DailySchedule[]> => {
    if (!user) return [];
    const q = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('routeId', '==', routeId),
      orderBy('date')
    );
    const snap = await getDocs(q);
    return Promise.all(
      snap.docs.map(d => loadScheduleWithVisits(user.id, d.id, d.data() as Record<string, unknown>))
    );
  }, [user]);

  // Move a visit to a different daily schedule (different date in same route)
  const moveVisitToDay = useCallback(async (visitId: string, targetDateStr: string): Promise<void> => {
    if (!user) return;

    // Load the visit
    const visitSnap = await getDoc(doc(db, 'users', user.id, 'scheduled_visits', visitId));
    if (!visitSnap.exists()) return;
    const visitData = visitSnap.data() as Record<string, unknown>;
    const currentScheduleId = visitData.dailyScheduleId as string;

    // Load current schedule to get routeId
    const curSchedSnap = await getDoc(doc(db, 'users', user.id, 'daily_schedules', currentScheduleId));
    if (!curSchedSnap.exists()) return;
    const routeId = curSchedSnap.data().routeId as string;
    const dow = new Date(targetDateStr + 'T12:00:00').getDay();

    // Find or create target daily_schedule
    const targetQ = query(
      collection(db, 'users', user.id, 'daily_schedules'),
      where('routeId', '==', routeId),
      where('date', '==', targetDateStr)
    );
    const targetSnap = await getDocs(targetQ);
    let targetScheduleId: string;

    const batch = writeBatch(db);

    if (!targetSnap.empty) {
      targetScheduleId = targetSnap.docs[0].id;
    } else {
      // Create new daily_schedule for that date
      const newSchedRef = doc(collection(db, 'users', user.id, 'daily_schedules'));
      targetScheduleId = newSchedRef.id;
      batch.set(newSchedRef, {
        routeId,
        date: targetDateStr,
        dayOfWeek: dow,
        visitCount: 0,
        suggestionCount: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Move the visit
    batch.update(doc(db, 'users', user.id, 'scheduled_visits', visitId), {
      dailyScheduleId: targetScheduleId,
    });

    // Decrement old schedule visitCount
    const isSuggestion = visitData.isSuggestion as boolean | undefined;
    const oldData = curSchedSnap.data();
    if (isSuggestion) {
      batch.update(curSchedSnap.ref, { suggestionCount: Math.max(0, ((oldData.suggestionCount as number) || 1) - 1) });
    } else {
      batch.update(curSchedSnap.ref, { visitCount: Math.max(0, ((oldData.visitCount as number) || 1) - 1) });
    }

    await batch.commit();
    await loadRoutes();
  }, [user]);

  return {
    routes, currentRoute, todaySchedule, isLoading, error,
    createRoute, updateRoute, deleteRoute, duplicateRoute, getRoute, getRouteForDate,
    getDailySchedule, updateScheduledVisit, moveVisitToDay, refreshRoutes: loadRoutes,
    findNextAvailableDay, rescheduleVisit, finishDayAndReschedule, getMonthSchedules,
    getRouteSchedules
  };
}
