import { describe, expect, it, vi } from 'vitest';
import type { Doctor } from '../types';
import { getCycleRange, isVisitedThisMonth } from './visitCycle';

describe('visit cycle', () => {
  it('starts in the previous month before the configured cycle day', () => {
    const range = getCycleRange(new Date(2026, 7, 5), 10);
    expect(range.start).toEqual(new Date(2026, 6, 10, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 7, 9, 23, 59, 59, 999));
  });

  it('recognizes a visit inside the active cycle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 12));
    expect(isVisitedThisMonth({ lastVisitDate: new Date(2026, 7, 11, 12) } as Doctor, 10)).toBe(true);
    vi.useRealTimers();
  });
});
