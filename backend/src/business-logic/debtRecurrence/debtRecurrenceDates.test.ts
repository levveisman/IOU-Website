import { describe, it, expect } from 'vitest';
import {
  enumerateDueMonths,
  enumerateDueWeeks,
  firstOccurrenceOnOrAfter,
  formatLocalDateOnly,
  occurrenceDateInMonth,
  parseLocalDateOnly,
  dayKey,
} from './debtRecurrenceDates';

describe('occurrenceDateInMonth', () => {
  it('clamps day 31 in February on a non-leap year', () => {
    const d = occurrenceDateInMonth(2026, 2, 31);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(28);
  });

  it('uses day 29 in February on a leap year', () => {
    const d = occurrenceDateInMonth(2024, 2, 31);
    expect(d.getDate()).toBe(29);
  });
});

describe('enumerateDueMonths', () => {
  it('includes all months from start through today when day is early in month', () => {
    const due = enumerateDueMonths({
      startDate: parseLocalDateOnly('2026-01-01'),
      endDate: null,
      dayOfMonth: 5,
      today: parseLocalDateOnly('2026-03-10'),
    });
    expect(due.map((d) => `${d.year}-${d.month}`)).toEqual(['2026-1', '2026-2', '2026-3']);
  });

  it('skips months whose occurrence is before startDate', () => {
    const due = enumerateDueMonths({
      startDate: parseLocalDateOnly('2026-03-20'),
      endDate: null,
      dayOfMonth: 5,
      today: parseLocalDateOnly('2026-05-10'),
    });
    expect(due.map((d) => `${d.year}-${d.month}`)).toEqual(['2026-4', '2026-5']);
  });

  it('excludes months whose occurrence is after today', () => {
    const due = enumerateDueMonths({
      startDate: parseLocalDateOnly('2026-01-01'),
      endDate: null,
      dayOfMonth: 15,
      today: parseLocalDateOnly('2026-02-10'),
    });
    expect(due.map((d) => `${d.year}-${d.month}`)).toEqual(['2026-1']);
  });

  it('respects inclusive endDate', () => {
    const due = enumerateDueMonths({
      startDate: parseLocalDateOnly('2026-01-01'),
      endDate: parseLocalDateOnly('2026-02-10'),
      dayOfMonth: 5,
      today: parseLocalDateOnly('2026-06-01'),
    });
    expect(due.map((d) => `${d.year}-${d.month}`)).toEqual(['2026-1', '2026-2']);
  });

  it('excludes occurrence after endDate in same month as end', () => {
    const due = enumerateDueMonths({
      startDate: parseLocalDateOnly('2026-01-01'),
      endDate: parseLocalDateOnly('2026-02-03'),
      dayOfMonth: 5,
      today: parseLocalDateOnly('2026-06-01'),
    });
    expect(due.map((d) => `${d.year}-${d.month}`)).toEqual(['2026-1']);
  });
});

describe('parseLocalDateOnly', () => {
  it('rejects invalid strings', () => {
    expect(() => parseLocalDateOnly('2026-13-01')).toThrow();
    expect(() => parseLocalDateOnly('not-a-date')).toThrow();
  });

  it('normalizes calendar overflow as invalid', () => {
    expect(() => parseLocalDateOnly('2026-02-30')).toThrow();
  });
});

describe('dayKey', () => {
  it('orders chronologically', () => {
    expect(dayKey(parseLocalDateOnly('2026-01-02'))).toBeLessThan(dayKey(parseLocalDateOnly('2026-02-01')));
  });
});

describe('firstOccurrenceOnOrAfter', () => {
  it('returns startDate when it already matches the weekday', () => {
    // 2026-08-03 is a Monday
    const d = firstOccurrenceOnOrAfter(parseLocalDateOnly('2026-08-03'), 1);
    expect(formatLocalDateOnly(d)).toBe('2026-08-03');
  });

  it('advances to the next matching weekday', () => {
    // Wednesday → next Monday
    const d = firstOccurrenceOnOrAfter(parseLocalDateOnly('2026-08-05'), 1);
    expect(formatLocalDateOnly(d)).toBe('2026-08-10');
  });
});

describe('enumerateDueWeeks', () => {
  it('includes weekly dates from first trigger through today', () => {
    const due = enumerateDueWeeks({
      startDate: parseLocalDateOnly('2026-08-03'), // Monday
      endDate: null,
      dayOfWeek: 1,
      today: parseLocalDateOnly('2026-08-24'),
    });
    expect(due.map((d) => formatLocalDateOnly(d.occurrenceDate))).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
    ]);
  });

  it('starts from the next trigger day when start is mid-week', () => {
    const due = enumerateDueWeeks({
      startDate: parseLocalDateOnly('2026-08-05'), // Wednesday
      endDate: null,
      dayOfWeek: 1, // Monday
      today: parseLocalDateOnly('2026-08-17'),
    });
    expect(due.map((d) => formatLocalDateOnly(d.occurrenceDate))).toEqual([
      '2026-08-10',
      '2026-08-17',
    ]);
  });

  it('excludes dates after today', () => {
    const due = enumerateDueWeeks({
      startDate: parseLocalDateOnly('2026-08-03'),
      endDate: null,
      dayOfWeek: 1,
      today: parseLocalDateOnly('2026-08-09'),
    });
    expect(due.map((d) => formatLocalDateOnly(d.occurrenceDate))).toEqual(['2026-08-03']);
  });

  it('respects inclusive endDate', () => {
    const due = enumerateDueWeeks({
      startDate: parseLocalDateOnly('2026-08-03'),
      endDate: parseLocalDateOnly('2026-08-12'),
      dayOfWeek: 1,
      today: parseLocalDateOnly('2026-08-31'),
    });
    expect(due.map((d) => formatLocalDateOnly(d.occurrenceDate))).toEqual([
      '2026-08-03',
      '2026-08-10',
    ]);
  });
});
