import pool from '../config/database';
import { setupDatabase } from './setupDatabase';

/** Idempotent DDL for tables/columns added after older schema.sql volumes. Safe to run on every startup. */
export async function ensureRuntimeSchema(): Promise<void> {
  try {
    console.log('Ensuring runtime schema...');

    const { rows } = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);
    const usersTableExists = rows[0]?.exists === true;

    if (!usersTableExists) {
      console.log(
        'No public.users table found; running full schema setup and default users...'
      );
      await setupDatabase();
    } else {
      // Auth queries this column; make sure it exists for older DB volumes.
      await pool.query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255)'
      );
    }

    await pool.query(
      'ALTER TABLE IF EXISTS leave_records ADD COLUMN IF NOT EXISTS description TEXT'
    );

    // Debt tracker v2 relies on this table.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS debt_transactions_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_entity TEXT NOT NULL CHECK (
          from_entity IN ('lev', 'danik', '2masters')
        ),
        to_entity TEXT NOT NULL CHECK (
          to_entity IN ('lev', 'danik', '2masters')
        ),
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        timestamp BIGINT NOT NULL,
        description TEXT,
        CONSTRAINT different_entities CHECK (from_entity != to_entity)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_transactions_v2_timestamp
      ON debt_transactions_v2(timestamp DESC)
    `);

    // Monthly debt recurrence tables (global templates + idempotent occurrences).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS debt_recurrence_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_entity TEXT NOT NULL CHECK (
          from_entity IN ('lev', 'danik', '2masters')
        ),
        to_entity TEXT NOT NULL CHECK (
          to_entity IN ('lev', 'danik', '2masters')
        ),
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        description TEXT,
        day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
        start_date DATE NOT NULL,
        end_date DATE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT debt_recurrence_different_entities CHECK (from_entity != to_entity),
        CONSTRAINT debt_recurrence_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS debt_recurrence_occurrences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES debt_recurrence_templates(id) ON DELETE CASCADE,
        calendar_year INTEGER NOT NULL,
        calendar_month INTEGER NOT NULL CHECK (calendar_month >= 1 AND calendar_month <= 12),
        transaction_id UUID NOT NULL REFERENCES debt_transactions_v2(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (template_id, calendar_year, calendar_month)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_recurrence_templates_active
      ON debt_recurrence_templates(active) WHERE active = TRUE
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_recurrence_occurrences_template
      ON debt_recurrence_occurrences(template_id)
    `);

    // Weekly debt recurrence (day_of_week: 1=Mon … 7=Sun; occurrences keyed by date).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS debt_weekly_recurrence_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_entity TEXT NOT NULL CHECK (
          from_entity IN ('lev', 'danik', '2masters')
        ),
        to_entity TEXT NOT NULL CHECK (
          to_entity IN ('lev', 'danik', '2masters')
        ),
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        description TEXT,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
        start_date DATE NOT NULL,
        end_date DATE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT debt_weekly_recurrence_different_entities CHECK (from_entity != to_entity),
        CONSTRAINT debt_weekly_recurrence_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS debt_weekly_recurrence_occurrences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES debt_weekly_recurrence_templates(id) ON DELETE CASCADE,
        occurrence_date DATE NOT NULL,
        transaction_id UUID NOT NULL REFERENCES debt_transactions_v2(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (template_id, occurrence_date)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_weekly_recurrence_templates_active
      ON debt_weekly_recurrence_templates(active) WHERE active = TRUE
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_debt_weekly_recurrence_occurrences_template
      ON debt_weekly_recurrence_occurrences(template_id)
    `);

    // Sales tracker (see addSalesTransactionsTable / addQuantity / addSeller migrations).
    // Older volumes never ran those scripts; Docker only runs this file before the server.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
        date DATE NOT NULL,
        description TEXT,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        seller VARCHAR(50) CHECK (seller IN ('leva', 'danik'))
      )
    `);

    await pool.query(`
      ALTER TABLE sales_transactions
      ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
    `);
    await pool.query(`
      ALTER TABLE sales_transactions
      ADD COLUMN IF NOT EXISTS seller VARCHAR(50) CHECK (seller IN ('leva', 'danik'))
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_transactions_id ON sales_transactions(id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_transactions_created_by ON sales_transactions(created_by)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(date)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_transactions_seller ON sales_transactions(seller)
    `);

    // Sales item presets for dropdowns (see addSalesItemsTable migration).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sales_items_name ON sales_items(name)
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS update_sales_transactions_updated_at ON sales_transactions
    `);
    await pool.query(`
      CREATE TRIGGER update_sales_transactions_updated_at
      BEFORE UPDATE ON sales_transactions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS update_sales_items_updated_at ON sales_items
    `);
    await pool.query(`
      CREATE TRIGGER update_sales_items_updated_at
      BEFORE UPDATE ON sales_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_debt_weekly_recurrence_templates_updated_at
      ON debt_weekly_recurrence_templates
    `);
    await pool.query(`
      CREATE TRIGGER update_debt_weekly_recurrence_templates_updated_at
      BEFORE UPDATE ON debt_weekly_recurrence_templates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);

    console.log('Runtime schema is up to date');
  } catch (error) {
    console.error('Failed to ensure runtime schema:', error);
    throw error;
  }
}

async function main() {
  try {
    await ensureRuntimeSchema();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

const ranAsCli = /ensureRuntimeSchema\.(ts|js)$/.test(process.argv[1] || '');
if (ranAsCli) {
  void main();
}
