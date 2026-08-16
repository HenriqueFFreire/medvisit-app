import { describe, expect, it } from 'vitest';
import { fromLocalDateString, toLocalDateString } from './date';

describe('local date utilities', () => {
  it('preserves the local calendar date', () => {
    expect(toLocalDateString(new Date(2026, 7, 12, 23, 30))).toBe('2026-08-12');
  });

  it('round-trips YYYY-MM-DD without changing the day', () => {
    expect(toLocalDateString(fromLocalDateString('2026-01-05'))).toBe('2026-01-05');
  });
});
