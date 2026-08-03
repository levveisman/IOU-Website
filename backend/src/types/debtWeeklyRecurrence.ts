import type { Entity } from './debtTracker';

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DebtWeeklyRecurrenceTemplate {
  id: string;
  from: Entity;
  to: Entity;
  amount: number;
  description?: string;
  dayOfWeek: IsoWeekday;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebtWeeklyRecurrenceTemplateInput {
  from: Entity;
  to: Entity;
  amount: number;
  description?: string;
  dayOfWeek: IsoWeekday;
  startDate: string;
  endDate?: string | null;
  active?: boolean;
}

export interface UpdateDebtWeeklyRecurrenceTemplateInput {
  from?: Entity;
  to?: Entity;
  amount?: number;
  description?: string | null;
  dayOfWeek?: IsoWeekday;
  startDate?: string;
  endDate?: string | null;
  active?: boolean;
}
