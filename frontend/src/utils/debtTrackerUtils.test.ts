import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  localDateInputString,
  dateInputToTransactionTimestamp,
} from './debtTrackerUtils';

describe('dateInputToTransactionTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses start of day for a past date', () => {
    const ts = dateInputToTransactionTimestamp('2020-01-15');
    expect(ts).toBe(new Date('2020-01-15T00:00:00').getTime());
  });

  it('uses current time when the selected date is today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:30:00'));

    const today = localDateInputString();
    const ts = dateInputToTransactionTimestamp(today);

    expect(ts).toBe(Date.now());
    expect(ts).toBeGreaterThan(new Date(`${today}T00:00:00`).getTime());
  });

  it('preserves a fine-grained timestamp when editing today without legacy midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:30:00'));

    const today = localDateInputString();
    const startOfDay = new Date(`${today}T00:00:00`).getTime();
    const existing = startOfDay + 60_000;

    expect(dateInputToTransactionTimestamp(today, existing)).toBe(existing);
  });

  it('replaces legacy midnight-only timestamp on today with current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T15:30:00'));

    const today = localDateInputString();
    const startOfDay = new Date(`${today}T00:00:00`).getTime();

    expect(dateInputToTransactionTimestamp(today, startOfDay)).toBe(Date.now());
  });
});
