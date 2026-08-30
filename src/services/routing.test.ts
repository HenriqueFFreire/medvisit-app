import { describe, expect, it } from 'vitest';
import type { Doctor } from '../types';
import { doctorAtAttendanceAddress, generateMultiWeekDistribution, generateScheduleFromDoctors } from './routing';

describe('doctor attendance address', () => {
  it('uses the address and coordinates linked to the selected weekday', () => {
    const doctor = {
      address: { street: 'Principal', number: '1', neighborhood: 'A', city: 'X', state: 'SE', zipCode: '00000-000' },
      coordinates: { latitude: 1, longitude: 1 },
      addresses: [{
        id: 'secondary',
        address: { street: 'Secundário', number: '2', neighborhood: 'B', city: 'Y', state: 'SE', zipCode: '00000-001' },
        coordinates: { latitude: 2, longitude: 2 }
      }],
      workingHours: [{ dayOfWeek: 1, addressId: 'secondary', period: 'M' }]
    } as Doctor;

    const resolved = doctorAtAttendanceAddress(doctor, 1);
    expect(resolved.address.street).toBe('Secundário');
    expect(resolved.coordinates).toEqual({ latitude: 2, longitude: 2 });
  });
});

describe('multi-week distribution', () => {
  const flexibleDoctor = (id: string, days = [1, 2, 3, 4, 5]) => ({
    id,
    name: `Doctor ${id}`,
    workingHours: days.map(dayOfWeek => ({ dayOfWeek, period: 'MT' as const })),
    address: { street: '', number: '', neighborhood: 'Centro', city: 'X', state: '', zipCode: '' },
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
    crm: id
  } as Doctor);

  it('balances visits across every day in the complete horizon', () => {
    const result = generateMultiWeekDistribution(
      Array.from({ length: 10 }, (_, index) => flexibleDoctor(String(index))), 2, 3
    );
    const loads = result.flatMap(week => [1, 2, 3, 4, 5].map(day => week[day].length));

    expect(loads).toEqual(Array(10).fill(1));
  });

  it('keeps unavoidable overflow balanced for conversion to suggestions', () => {
    const result = generateMultiWeekDistribution(
      Array.from({ length: 13 }, (_, index) => flexibleDoctor(String(index), [1])), 2, 3
    );
    const mondayLoads = result.map(week => week[1].length);

    expect(Math.max(...mondayLoads) - Math.min(...mondayLoads)).toBeLessThanOrEqual(1);
    expect(mondayLoads.reduce((sum, load) => sum + Math.max(0, load - 3), 0)).toBe(7);
  });
});

describe('scheduled route order', () => {
  const doctor = (id: string, name: string, specificTime?: string) => ({
    id,
    name,
    workingHours: [{
      dayOfWeek: 1,
      period: specificTime ? 'AG' : 'M',
      ...(specificTime ? { specificTime } : {})
    }],
    address: { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' },
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
    crm: id
  } as Doctor);

  it('orders specific appointments by time instead of doctor name', () => {
    const visits = generateScheduleFromDoctors(
      [doctor('1', 'Ana', '15:00'), doctor('2', 'Zeca', '10:00')],
      new Date(2026, 7, 24),
      30,
      '08:00',
      '18:00',
      0
    );

    expect(visits.map(visit => visit.doctorId)).toEqual(['2', '1']);
    expect(visits.map(visit => visit.scheduledTime)).toEqual(['10:00', '15:00']);
  });

  it('adds travel time before the next visit', () => {
    const first = { ...doctor('1', 'Ana'), coordinates: { latitude: 0, longitude: 0 } };
    const second = { ...doctor('2', 'Bia'), coordinates: { latitude: 0, longitude: 0.2698 } };
    const visits = generateScheduleFromDoctors(
      [first, second], new Date(2026, 7, 24), 30, '08:00', '18:00', 0
    );

    expect(visits[0].scheduledTime).toBe('08:00');
    expect(visits[1].estimatedTravelTime).toBe(60);
    expect(visits[1].scheduledTime).toBe('09:30');
  });

  it('does not schedule an appointment after its fixed time', () => {
    const visits = generateScheduleFromDoctors(
      [doctor('1', 'Ana', '11:50')], new Date(2026, 7, 24), 30, '12:00', '18:00', 0
    );

    expect(visits).toEqual([]);
  });
});
