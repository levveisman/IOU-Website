import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';
import pool from '../config/database';
import {
  getDefaultHolidayImportConfig,
  importHolidaysFromNager,
} from '../services/holidayImportService';

/**
 * 1 January 00:00 (Australia/Melbourne): import Victorian public holidays for the new year.
 */
export function startPublicHolidayImportScheduler(): void {
  if (
    process.env.VITEST === 'true' ||
    process.env.DISABLE_PUBLIC_HOLIDAY_IMPORT_CRON === 'true'
  ) {
    return;
  }

  const { countryCode, subdivision, timezone } = getDefaultHolidayImportConfig();

  cron.schedule(
    '0 0 1 1 *',
    async () => {
      const year = parseInt(formatInTimeZone(new Date(), timezone, 'yyyy'), 10);
      try {
        const result = await importHolidaysFromNager(pool, {
          year,
          countryCode,
          subdivision,
        });
        console.log(
          `[public holidays] ${year} import (${subdivision}): inserted ${result.inserted}, skipped ${result.skipped}`
        );
      } catch (err) {
        if (err instanceof Error && err.message === 'NO_HOLIDAYS_FOUND') {
          console.warn(`[public holidays] no holidays returned for ${year}/${countryCode}`);
          return;
        }
        console.error('[public holidays] scheduled import failed:', err);
      }
    },
    { timezone }
  );

  console.log(
    `[public holidays] cron registered: 1 Jan 00:00 (${timezone}), ${countryCode} + ${subdivision}`
  );
}
