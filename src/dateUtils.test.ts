import { afterEach, describe, expect, it, vi } from 'vitest';
import { isOverdue } from './dateUtils';

describe('dateUtils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false for undefined due date', () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it('marks date before today as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T08:00:00.000Z'));
    expect(isOverdue(new Date('2026-03-29T12:00:00.000Z').getTime())).toBe(true);
  });

  it('does not mark today or future as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T08:00:00.000Z'));
    expect(isOverdue(new Date('2026-03-30T23:00:00.000Z').getTime())).toBe(false);
    expect(isOverdue(new Date('2026-03-31T00:00:00.000Z').getTime())).toBe(false);
  });
});
