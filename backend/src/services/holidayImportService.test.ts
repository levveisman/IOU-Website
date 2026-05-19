import { describe, it, expect } from 'vitest';
import { holidayAppliesToSubdivision, type NagerHoliday } from './holidayImportService';

function makeHoliday(overrides: Partial<NagerHoliday>): NagerHoliday {
  return {
    date: '2026-01-01',
    localName: 'Test',
    name: 'Test',
    countryCode: 'AU',
    fixed: false,
    global: false,
    counties: null,
    launchYear: null,
    types: ['Public'],
    ...overrides,
  };
}

describe('holidayAppliesToSubdivision', () => {
  it('includes nationwide holidays', () => {
    const holiday = makeHoliday({ global: true, counties: null });
    expect(holidayAppliesToSubdivision(holiday, 'AU-VIC')).toBe(true);
  });

  it('includes holidays tagged for Victoria', () => {
    const holiday = makeHoliday({ global: false, counties: ['AU-VIC'] });
    expect(holidayAppliesToSubdivision(holiday, 'AU-VIC')).toBe(true);
  });

  it('excludes holidays for other states only', () => {
    const holiday = makeHoliday({ global: false, counties: ['AU-WA'] });
    expect(holidayAppliesToSubdivision(holiday, 'AU-VIC')).toBe(false);
  });

  it('excludes non-global holidays with no counties', () => {
    const holiday = makeHoliday({ global: false, counties: null });
    expect(holidayAppliesToSubdivision(holiday, 'AU-VIC')).toBe(false);
  });

  it('includes multi-state holidays when Victoria is listed', () => {
    const holiday = makeHoliday({
      global: false,
      counties: ['AU-NSW', 'AU-VIC'],
    });
    expect(holidayAppliesToSubdivision(holiday, 'AU-VIC')).toBe(true);
  });
});
