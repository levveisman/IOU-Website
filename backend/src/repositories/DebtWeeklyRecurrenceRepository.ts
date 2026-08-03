import { Pool, PoolClient } from 'pg';
import type {
  CreateDebtWeeklyRecurrenceTemplateInput,
  DebtWeeklyRecurrenceTemplate,
  IsoWeekday,
  UpdateDebtWeeklyRecurrenceTemplateInput,
} from '../types/debtWeeklyRecurrence';
import type { Entity } from '../types/debtTracker';

function mapTemplateRow(row: any): DebtWeeklyRecurrenceTemplate {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  return {
    id: row.id,
    from: row.from_entity as Entity,
    to: row.to_entity as Entity,
    amount: parseFloat(row.amount),
    description: row.description ?? undefined,
    dayOfWeek: row.day_of_week as IsoWeekday,
    startDate: row.start_date as string,
    endDate: row.end_date ?? null,
    active: row.active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const SELECT_COLS = `id, from_entity, to_entity, amount, description, day_of_week,
              start_date::text AS start_date, end_date::text AS end_date, active,
              created_at, updated_at`;

export class DebtWeeklyRecurrenceRepository {
  constructor(private pool: Pool) {}

  async listAll(): Promise<DebtWeeklyRecurrenceTemplate[]> {
    const result = await this.pool.query(
      `SELECT ${SELECT_COLS}
       FROM debt_weekly_recurrence_templates
       ORDER BY created_at DESC`
    );
    return result.rows.map(mapTemplateRow);
  }

  async listActive(): Promise<DebtWeeklyRecurrenceTemplate[]> {
    const result = await this.pool.query(
      `SELECT ${SELECT_COLS}
       FROM debt_weekly_recurrence_templates
       WHERE active = TRUE
       ORDER BY created_at ASC`
    );
    return result.rows.map(mapTemplateRow);
  }

  async getById(id: string): Promise<DebtWeeklyRecurrenceTemplate | null> {
    const result = await this.pool.query(
      `SELECT ${SELECT_COLS}
       FROM debt_weekly_recurrence_templates WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return mapTemplateRow(result.rows[0]);
  }

  async create(input: CreateDebtWeeklyRecurrenceTemplateInput): Promise<DebtWeeklyRecurrenceTemplate> {
    const result = await this.pool.query(
      `INSERT INTO debt_weekly_recurrence_templates
        (from_entity, to_entity, amount, description, day_of_week, start_date, end_date, active)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, COALESCE($8, TRUE))
       RETURNING ${SELECT_COLS}`,
      [
        input.from,
        input.to,
        input.amount,
        input.description ?? null,
        input.dayOfWeek,
        input.startDate,
        input.endDate ?? null,
        input.active,
      ]
    );
    return mapTemplateRow(result.rows[0]);
  }

  async update(
    id: string,
    input: UpdateDebtWeeklyRecurrenceTemplateInput
  ): Promise<DebtWeeklyRecurrenceTemplate | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (input.from !== undefined) {
      fields.push(`from_entity = $${i++}`);
      values.push(input.from);
    }
    if (input.to !== undefined) {
      fields.push(`to_entity = $${i++}`);
      values.push(input.to);
    }
    if (input.amount !== undefined) {
      fields.push(`amount = $${i++}`);
      values.push(input.amount);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(input.description);
    }
    if (input.dayOfWeek !== undefined) {
      fields.push(`day_of_week = $${i++}`);
      values.push(input.dayOfWeek);
    }
    if (input.startDate !== undefined) {
      fields.push(`start_date = $${i++}::date`);
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      fields.push(`end_date = $${i++}::date`);
      values.push(input.endDate);
    }
    if (input.active !== undefined) {
      fields.push(`active = $${i++}`);
      values.push(input.active);
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await this.pool.query(
      `UPDATE debt_weekly_recurrence_templates SET ${fields.join(', ')}
       WHERE id = $${i}
       RETURNING ${SELECT_COLS}`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapTemplateRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM debt_weekly_recurrence_templates WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async occurrenceExists(
    client: Pool | PoolClient,
    templateId: string,
    occurrenceDate: string
  ): Promise<boolean> {
    const r = await client.query(
      `SELECT 1 FROM debt_weekly_recurrence_occurrences
       WHERE template_id = $1 AND occurrence_date = $2::date`,
      [templateId, occurrenceDate]
    );
    return r.rows.length > 0;
  }

  async insertOccurrence(
    client: PoolClient,
    templateId: string,
    occurrenceDate: string,
    transactionId: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO debt_weekly_recurrence_occurrences (template_id, occurrence_date, transaction_id)
       VALUES ($1, $2::date, $3)`,
      [templateId, occurrenceDate, transactionId]
    );
  }
}
