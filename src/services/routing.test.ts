import { describe, expect, it } from 'vitest';
import type { Doctor } from '../types';
import { doctorAtAttendanceAddress } from './routing';

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
