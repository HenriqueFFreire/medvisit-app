import { describe, expect, it } from 'vitest';
import type { Doctor } from '../types';
import { doctorAtAttendanceAddress, generateScheduleFromDoctors } from './routing';

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
});
