import { Pool, PoolClient } from 'pg';
import { validate } from '../business-logic/debtTracker/TransactionValidator';
import {
  enumerateDueWeeks,
  formatLocalDateOnly,
  parseLocalDateOnly,
} from '../business-logic/debtRecurrence/debtRecurrenceDates';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { DebtWeeklyRecurrenceRepository } from '../repositories/DebtWeeklyRecurrenceRepository';
import type { DebtWeeklyRecurrenceTemplate } from '../types/debtWeeklyRecurrence';

/**
 * Creates debt_transactions_v2 rows for all due weekly dates that do not yet have an occurrence row.
 */
export async function processDebtWeeklyRecurrence(
  pool: Pool,
  transactionRepository: TransactionRepository,
  weeklyRepository: DebtWeeklyRecurrenceRepository,
  runDate: Date = new Date()
): Promise<number> {
  const templates = await weeklyRepository.listActive();
  if (templates.length === 0) return 0;

  const today = parseLocalDateOnly(
    `${runDate.getFullYear()}-${String(runDate.getMonth() + 1).padStart(2, '0')}-${String(runDate.getDate()).padStart(2, '0')}`
  );

  let created = 0;
  const client = await pool.connect();
  try {
    for (const t of templates) {
      const n = await processOneWeeklyTemplate(client, transactionRepository, weeklyRepository, t, today);
      created += n;
    }
  } finally {
    client.release();
  }
  return created;
}

async function processOneWeeklyTemplate(
  client: PoolClient,
  transactionRepository: TransactionRepository,
  weeklyRepository: DebtWeeklyRecurrenceRepository,
  template: DebtWeeklyRecurrenceTemplate,
  today: Date
): Promise<number> {
  const startDate = parseLocalDateOnly(template.startDate);
  const endDate = template.endDate ? parseLocalDateOnly(template.endDate) : null;

  const due = enumerateDueWeeks({
    startDate,
    endDate,
    dayOfWeek: template.dayOfWeek,
    today,
  });

  let n = 0;
  for (const period of due) {
    const occurrenceDateStr = formatLocalDateOnly(period.occurrenceDate);
    await client.query('BEGIN');
    try {
      const exists = await weeklyRepository.occurrenceExists(client, template.id, occurrenceDateStr);
      if (exists) {
        await client.query('COMMIT');
        continue;
      }

      const ts = period.occurrenceDate.getTime();
      const txPayload = {
        from: template.from,
        to: template.to,
        amount: template.amount,
        timestamp: ts,
        description: template.description,
      };
      const validation = validate(txPayload);
      if (!validation.valid) {
        await client.query('ROLLBACK');
        console.error(
          `[debt weekly recurrence] template ${template.id} date ${occurrenceDateStr} validation failed:`,
          validation.errors
        );
        continue;
      }

      const createdTx = await transactionRepository.create(txPayload, client);
      await weeklyRepository.insertOccurrence(client, template.id, occurrenceDateStr, createdTx.id);
      await client.query('COMMIT');
      n += 1;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[debt weekly recurrence] template ${template.id} date ${occurrenceDateStr}:`, e);
    }
  }
  return n;
}
