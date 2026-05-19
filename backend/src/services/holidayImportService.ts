import axios from 'axios';
import type { Pool } from 'pg';

export interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface SkippedHoliday {
  name: string;
  date: string;
  reason: string;
}

export interface HolidayImportResult {
  inserted: number;
  skipped: number;
  insertedHolidays: unknown[];
  skippedHolidays: SkippedHoliday[];
}

/** National holidays plus those that apply in the given subdivision (e.g. AU-VIC). */
export function holidayAppliesToSubdivision(
  holiday: NagerHoliday,
  subdivision: string
): boolean {
  if (holiday.global) {
    return true;
  }
  if (!holiday.counties?.length) {
    return false;
  }
  return holiday.counties.includes(subdivision);
}

export async function fetchNagerHolidays(
  year: number,
  countryCode: string
): Promise<NagerHoliday[]> {
  const response = await axios.get<NagerHoliday[]>(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
  );
  return response.data ?? [];
}

export async function importHolidaysFromNager(
  pool: Pool,
  options: {
    year: number;
    countryCode: string;
    subdivision?: string | null;
  }
): Promise<HolidayImportResult> {
  const { year, countryCode, subdivision } = options;
  const holidays = await fetchNagerHolidays(year, countryCode);

  if (!holidays.length) {
    throw new Error('NO_HOLIDAYS_FOUND');
  }

  const insertedHolidays: unknown[] = [];
  const skippedHolidays: SkippedHoliday[] = [];

  for (const holiday of holidays) {
    if (!holiday.types.includes('Public')) {
      skippedHolidays.push({
        name: holiday.name,
        date: holiday.date,
        reason: 'Not a public holiday (observance only)',
      });
      continue;
    }

    if (subdivision && !holidayAppliesToSubdivision(holiday, subdivision)) {
      skippedHolidays.push({
        name: holiday.name,
        date: holiday.date,
        reason: `Does not apply to ${subdivision}`,
      });
      continue;
    }

    try {
      const existingHoliday = await pool.query(
        'SELECT id FROM public_holidays WHERE date = $1',
        [holiday.date]
      );

      if (existingHoliday.rows.length > 0) {
        skippedHolidays.push({
          name: holiday.name,
          date: holiday.date,
          reason: 'Already exists',
        });
        continue;
      }

      const displayName = holiday.localName || holiday.name;
      const result = await pool.query(
        'INSERT INTO public_holidays (name, date) VALUES ($1, $2) RETURNING *',
        [displayName, holiday.date]
      );

      insertedHolidays.push(result.rows[0]);
    } catch (error) {
      console.error(`Error inserting holiday ${holiday.name}:`, error);
      skippedHolidays.push({
        name: holiday.name,
        date: holiday.date,
        reason: 'Database error',
      });
    }
  }

  return {
    inserted: insertedHolidays.length,
    skipped: skippedHolidays.length,
    insertedHolidays,
    skippedHolidays,
  };
}

export function getDefaultHolidayImportConfig(): {
  countryCode: string;
  subdivision: string;
  timezone: string;
} {
  return {
    countryCode: process.env.HOLIDAY_IMPORT_COUNTRY || 'AU',
    subdivision: process.env.HOLIDAY_IMPORT_SUBDIVISION || 'AU-VIC',
    timezone: process.env.HOLIDAY_IMPORT_TIMEZONE || 'Australia/Melbourne',
  };
}
