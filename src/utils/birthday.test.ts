import { describe, expect, it } from 'vitest';
import type { Doctor } from '../types';
import { getBirthdaysThisMonth, getBirthdaysThisWeek, getBirthdaysToday } from './birthday';

const doctor = (id: string, name: string, birthDate?: string) => ({ id, name, birthDate } as Doctor);

describe('birthday filters', () => {
  const today = new Date(2026, 7, 12, 12);
  const doctors = [
    doctor('1', 'Ana', '1980-08-12'),
    doctor('2', 'Bruno', '1975-08-15'),
    doctor('3', 'Carla', '1990-08-25'),
    doctor('4', 'Sem Data')
  ];

  it('finds birthdays today regardless of birth year', () => {
    expect(getBirthdaysToday(doctors, today).map(item => item.doctor.name)).toEqual(['Ana']);
  });

  it('finds birthdays in the next seven days', () => {
    expect(getBirthdaysThisWeek(doctors, today).map(item => item.doctor.name)).toEqual(['Ana', 'Bruno']);
  });

  it('finds all birthdays in the current month', () => {
    expect(getBirthdaysThisMonth(doctors, today)).toHaveLength(3);
  });

  it('accepts birthdays stored with only month and day', () => {
    const withoutYear = [doctor('5', 'Daniel', '08-12')];
    expect(getBirthdaysToday(withoutYear, today).map(item => item.doctor.name)).toEqual(['Daniel']);
  });
});
