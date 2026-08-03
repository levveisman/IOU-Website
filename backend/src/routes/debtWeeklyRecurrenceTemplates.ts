import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import pool from '../config/database';
import { DebtWeeklyRecurrenceRepository } from '../repositories/DebtWeeklyRecurrenceRepository';
import { parseLocalDateOnly } from '../business-logic/debtRecurrence/debtRecurrenceDates';
import type { Entity } from '../types/debtTracker';
import type {
  CreateDebtWeeklyRecurrenceTemplateInput,
  IsoWeekday,
  UpdateDebtWeeklyRecurrenceTemplateInput,
} from '../types/debtWeeklyRecurrence';

const router = Router();
router.use(isAuthenticated);

const repo = new DebtWeeklyRecurrenceRepository(pool);

const VALID_ENTITIES: readonly Entity[] = ['lev', 'danik', '2masters'];

function isEntity(s: unknown): s is Entity {
  return typeof s === 'string' && (VALID_ENTITIES as readonly string[]).includes(s.toLowerCase());
}

function parseDayOfWeek(value: unknown): IsoWeekday | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 7) return null;
  return n as IsoWeekday;
}

function parseDateField(name: string, value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error(`${name} must be a YYYY-MM-DD string`);
  }
  parseLocalDateOnly(value);
  return value;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await repo.listAll();
    return res.json({ templates });
  } catch (e) {
    console.error('debt weekly recurrence list:', e);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to list templates' } });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { from, to, amount, description, dayOfWeek, startDate, endDate, active } = req.body;

    if (!isEntity(from) || !isEntity(to)) {
      return res.status(400).json({
        error: { code: 'INVALID_ENTITY', message: 'from and to must be lev, danik, or 2masters' },
      });
    }
    if (from.toLowerCase() === to.toLowerCase()) {
      return res.status(400).json({
        error: { code: 'SELF_TRANSACTION', message: 'from and to must be different' },
      });
    }

    const amt = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      return res.status(400).json({
        error: { code: 'INVALID_AMOUNT', message: 'amount must be a positive number' },
      });
    }

    const dow = parseDayOfWeek(dayOfWeek);
    if (dow === null) {
      return res.status(400).json({
        error: { code: 'INVALID_DAY', message: 'dayOfWeek must be an integer from 1 (Mon) to 7 (Sun)' },
      });
    }

    if (typeof startDate !== 'string') {
      return res.status(400).json({
        error: { code: 'MISSING_START', message: 'startDate (YYYY-MM-DD) is required' },
      });
    }
    parseLocalDateOnly(startDate);

    let endStr: string | null | undefined;
    try {
      endStr = parseDateField('endDate', endDate);
    } catch (err: any) {
      return res.status(400).json({ error: { code: 'INVALID_END', message: err.message } });
    }

    if (endStr !== null && endStr !== undefined) {
      const s = parseLocalDateOnly(startDate).getTime();
      const e = parseLocalDateOnly(endStr).getTime();
      if (e < s) {
        return res.status(400).json({
          error: { code: 'INVALID_RANGE', message: 'endDate must be on or after startDate' },
        });
      }
    }

    const input: CreateDebtWeeklyRecurrenceTemplateInput = {
      from: from.toLowerCase() as Entity,
      to: to.toLowerCase() as Entity,
      amount: amt,
      description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
      dayOfWeek: dow,
      startDate,
      endDate: endStr === undefined ? null : endStr,
      active: typeof active === 'boolean' ? active : true,
    };

    const template = await repo.create(input);
    return res.status(201).json({ template, warnings: [] });
  } catch (e: any) {
    console.error('debt weekly recurrence create:', e);
    if (e.message?.includes('Invalid date')) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: e.message } });
    }
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to create template' } });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await repo.getById(id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    const body = req.body || {};
    const updates: UpdateDebtWeeklyRecurrenceTemplateInput = {};

    if (body.from !== undefined) {
      if (!isEntity(body.from)) {
        return res.status(400).json({ error: { code: 'INVALID_ENTITY', message: 'Invalid from' } });
      }
      updates.from = body.from.toLowerCase() as Entity;
    }
    if (body.to !== undefined) {
      if (!isEntity(body.to)) {
        return res.status(400).json({ error: { code: 'INVALID_ENTITY', message: 'Invalid to' } });
      }
      updates.to = body.to.toLowerCase() as Entity;
    }

    const nextFrom = updates.from ?? existing.from;
    const nextTo = updates.to ?? existing.to;
    if (nextFrom === nextTo) {
      return res.status(400).json({
        error: { code: 'SELF_TRANSACTION', message: 'from and to must be different' },
      });
    }

    if (body.amount !== undefined) {
      const amt = typeof body.amount === 'string' ? parseFloat(body.amount) : Number(body.amount);
      if (Number.isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: { code: 'INVALID_AMOUNT', message: 'Invalid amount' } });
      }
      updates.amount = amt;
    }

    if (body.description !== undefined) {
      updates.description =
        typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null;
    }

    if (body.dayOfWeek !== undefined) {
      const dow = parseDayOfWeek(body.dayOfWeek);
      if (dow === null) {
        return res.status(400).json({
          error: { code: 'INVALID_DAY', message: 'dayOfWeek must be 1 (Mon) – 7 (Sun)' },
        });
      }
      updates.dayOfWeek = dow;
    }

    if (body.startDate !== undefined) {
      if (typeof body.startDate !== 'string') {
        return res.status(400).json({ error: { code: 'INVALID_DATE', message: 'startDate must be YYYY-MM-DD' } });
      }
      parseLocalDateOnly(body.startDate);
      updates.startDate = body.startDate;
    }

    let endStr: string | null | undefined;
    try {
      endStr = parseDateField('endDate', body.endDate);
    } catch (err: any) {
      return res.status(400).json({ error: { code: 'INVALID_END', message: err.message } });
    }
    if (endStr !== undefined) {
      updates.endDate = endStr;
    }

    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return res.status(400).json({ error: { code: 'INVALID_ACTIVE', message: 'active must be boolean' } });
      }
      updates.active = body.active;
    }

    const nextStart = updates.startDate ?? existing.startDate;
    const nextEnd = updates.endDate !== undefined ? updates.endDate : existing.endDate;
    if (nextEnd) {
      const s = parseLocalDateOnly(nextStart).getTime();
      const e = parseLocalDateOnly(nextEnd).getTime();
      if (e < s) {
        return res.status(400).json({
          error: { code: 'INVALID_RANGE', message: 'endDate must be on or after startDate' },
        });
      }
    }

    const updated = await repo.update(id, updates);
    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }

    return res.json({ template: updated, warnings: [] });
  } catch (e: any) {
    console.error('debt weekly recurrence update:', e);
    if (e.message?.includes('Invalid date')) {
      return res.status(400).json({ error: { code: 'INVALID_DATE', message: e.message } });
    }
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to update template' } });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await repo.delete(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    }
    return res.status(204).send();
  } catch (e) {
    console.error('debt weekly recurrence delete:', e);
    return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Failed to delete template' } });
  }
});

export default router;
