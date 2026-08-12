import type { Doctor } from '../types';

export function getCycleRange(today: Date, cycleStartDay = 1): { start: Date; end: Date } {
  const day = Math.min(Math.max(cycleStartDay, 1), 28);
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  let startYear = year;
  let startMonth = month;

  if (todayDate < day) {
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
  }

  return {
    start: new Date(startYear, startMonth, day, 0, 0, 0, 0),
    end: new Date(startYear, startMonth + 1, day - 1, 23, 59, 59, 999)
  };
}

export function isVisitedThisMonth(doctor: Doctor, cycleStartDay = 1): boolean {
  if (!doctor.lastVisitDate) return false;
  const { start, end } = getCycleRange(new Date(), cycleStartDay);
  const visitDate = new Date(doctor.lastVisitDate);
  return visitDate >= start && visitDate <= end;
}
