// Utility functions for Debt Tracker V2

export type Entity = 'lev' | 'danik' | '2masters';

export interface DebtResult {
  debtor: 'lev' | 'danik' | 'none';
  creditor: 'lev' | 'danik' | 'none';
  amount: number;
}

/**
 * Converts entity names to display format
 * @param entity - The entity name ('lev', 'danik', or '2masters')
 * @returns The display name with proper capitalization
 */
export function formatEntityName(entity: Entity): string {
  if (entity === '2masters') {
    return '2 Masters';
  }
  return entity.charAt(0).toUpperCase() + entity.slice(1);
}

/**
 * Formats an amount as currency with $ symbol and 2 decimal places
 * @param amount - The numeric amount to format
 * @returns A formatted currency string like "$50.00"
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Converts a DebtResult to a human-readable display string
 * @param result - The debt calculation result
 * @returns A formatted string like "Danik owes Lev $50.00" or "No debt"
 */
export function formatDebtDisplay(result: DebtResult): string {
  if (result.debtor === 'none' || result.creditor === 'none' || result.amount === 0) {
    return 'No debt';
  }

  const debtorName = formatEntityName(result.debtor);
  const creditorName = formatEntityName(result.creditor);
  const formattedAmount = formatCurrency(result.amount);

  return `${debtorName} owes ${creditorName} ${formattedAmount}`;
}

/**
 * YYYY-MM-DD for the local calendar day (matches date input value).
 */
export function localDateInputString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Unix ms for storing a debt transaction.
 * - Selected date is today (local): use current time so new rows sort first.
 * - Other dates: start of that day in local timezone.
 * When editing, pass existingTimestamp to keep order unless it is legacy midnight-only.
 */
export function dateInputToTransactionTimestamp(
  dateStr: string,
  existingTimestamp?: number
): number {
  const startOfDay = new Date(`${dateStr}T00:00:00`).getTime();
  const endOfDay = startOfDay + 86_400_000 - 1;

  if (dateStr === localDateInputString()) {
    if (existingTimestamp !== undefined) {
      const withinDay =
        existingTimestamp >= startOfDay && existingTimestamp <= endOfDay;
      const isLegacyMidnightOnly = existingTimestamp === startOfDay;
      if (withinDay && !isLegacyMidnightOnly) {
        return existingTimestamp;
      }
    }
    return Date.now();
  }

  return startOfDay;
}

/**
 * Converts a Unix timestamp to a human-readable format
 * @param timestamp - Unix timestamp in milliseconds
 * @returns A formatted date string like "23/04/2026"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}
