import cron from 'node-cron';
import pool from '../config/database';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { DebtRecurrenceRepository } from '../repositories/DebtRecurrenceRepository';
import { DebtWeeklyRecurrenceRepository } from '../repositories/DebtWeeklyRecurrenceRepository';
import { processDebtRecurrence } from '../services/debtRecurrenceService';
import { processDebtWeeklyRecurrence } from '../services/debtWeeklyRecurrenceService';

/**
 * Daily at 00:05 server local time: backfill missed monthly/weekly debt transactions from templates.
 */
export function startDebtRecurrenceScheduler(): void {
  if (process.env.VITEST === 'true' || process.env.DISABLE_DEBT_RECURRENCE_CRON === 'true') {
    return;
  }

  const transactionRepository = new TransactionRepository(pool);
  const recurrenceRepository = new DebtRecurrenceRepository(pool);
  const weeklyRepository = new DebtWeeklyRecurrenceRepository(pool);

  cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        const monthly = await processDebtRecurrence(
          pool,
          transactionRepository,
          recurrenceRepository,
          new Date()
        );
        if (monthly > 0) {
          console.log(`[debt recurrence] created ${monthly} monthly transaction(s)`);
        }
        const weekly = await processDebtWeeklyRecurrence(
          pool,
          transactionRepository,
          weeklyRepository,
          new Date()
        );
        if (weekly > 0) {
          console.log(`[debt weekly recurrence] created ${weekly} weekly transaction(s)`);
        }
      } catch (err) {
        console.error('[debt recurrence] scheduled run failed:', err);
      }
    }
  );

  console.log('[debt recurrence] cron registered: daily at 00:05 (server local time)');
}
