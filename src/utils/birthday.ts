import type { Doctor } from '../types';

export interface DoctorBirthday {
  doctor: Doctor;
  day: number;
  month: number;
  dateThisYear: Date;
}

function parseBirthday(doctor: Doctor, referenceYear: number): DoctorBirthday | null {
  if (!doctor.birthDate) return null;
  const parts = doctor.birthDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [, month, day] = parts;
  const dateThisYear = new Date(referenceYear, month - 1, day, 12);
  if (dateThisYear.getMonth() !== month - 1 || dateThisYear.getDate() !== day) return null;
  return { doctor, day, month, dateThisYear };
}

export function getBirthdaysToday(doctors: Doctor[], today = new Date()): DoctorBirthday[] {
  return doctors
    .map(doctor => parseBirthday(doctor, today.getFullYear()))
    .filter((item): item is DoctorBirthday => Boolean(item && item.day === today.getDate() && item.month === today.getMonth() + 1))
    .sort((a, b) => a.doctor.name.localeCompare(b.doctor.name));
}

export function getBirthdaysThisWeek(doctors: Doctor[], today = new Date()): DoctorBirthday[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return doctors
    .map(doctor => {
      const currentYear = parseBirthday(doctor, start.getFullYear());
      if (!currentYear) return null;
      if (currentYear.dateThisYear >= start && currentYear.dateThisYear <= end) return currentYear;
      if (end.getFullYear() !== start.getFullYear()) {
        const nextYear = parseBirthday(doctor, end.getFullYear());
        if (nextYear && nextYear.dateThisYear >= start && nextYear.dateThisYear <= end) return nextYear;
      }
      return null;
    })
    .filter((item): item is DoctorBirthday => Boolean(item))
    .sort((a, b) => a.dateThisYear.getTime() - b.dateThisYear.getTime());
}

export function getBirthdaysThisMonth(doctors: Doctor[], today = new Date()): DoctorBirthday[] {
  return doctors
    .map(doctor => parseBirthday(doctor, today.getFullYear()))
    .filter((item): item is DoctorBirthday => Boolean(item && item.month === today.getMonth() + 1))
    .sort((a, b) => a.day - b.day || a.doctor.name.localeCompare(b.doctor.name));
}
