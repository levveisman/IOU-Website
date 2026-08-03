-- UOMi Database Schema
-- Set timezone for this session (should match DB_TIMEZONE environment variable)
SET timezone = 'Australia/Melbourne';

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS debt_weekly_recurrence_occurrences CASCADE;
DROP TABLE IF EXISTS debt_weekly_recurrence_templates CASCADE;
DROP TABLE IF EXISTS debt_recurrence_occurrences CASCADE;
DROP TABLE IF EXISTS debt_recurrence_templates CASCADE;
DROP TABLE IF EXISTS debt_transactions_v2 CASCADE;
DROP TABLE IF EXISTS leave_records CASCADE;
DROP TABLE IF EXISTS public_holidays CASCADE;
DROP TABLE IF EXISTS closed_dates CASCADE;
DROP TABLE IF EXISTS birthdays CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash VARCHAR(255),
  two_factor_secret VARCHAR(255),
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (transaction_type IN ('personal', 'company')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT different_users CHECK (from_user_id IS NULL OR from_user_id != to_user_id),
  CONSTRAINT company_transaction_check CHECK (
    (transaction_type = 'personal' AND from_user_id IS NOT NULL) OR
    (transaction_type = 'company' AND from_user_id IS NULL)
  )
);

-- Debt transactions v2 table
CREATE TABLE debt_transactions_v2 (
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
);

-- Global monthly debt recurrence templates (cron-generated transactions)
CREATE TABLE debt_recurrence_templates (
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
);

CREATE TABLE debt_recurrence_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES debt_recurrence_templates(id) ON DELETE CASCADE,
  calendar_year INTEGER NOT NULL,
  calendar_month INTEGER NOT NULL CHECK (calendar_month >= 1 AND calendar_month <= 12),
  transaction_id UUID NOT NULL REFERENCES debt_transactions_v2(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_id, calendar_year, calendar_month)
);

-- Weekly debt recurrence templates (day_of_week: 1=Mon … 7=Sun)
CREATE TABLE debt_weekly_recurrence_templates (
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
);

CREATE TABLE debt_weekly_recurrence_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES debt_weekly_recurrence_templates(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  transaction_id UUID NOT NULL REFERENCES debt_transactions_v2(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_id, occurrence_date)
);

-- Leave records table
CREATE TABLE leave_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  business_days INTEGER NOT NULL CHECK (business_days >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_date_range CHECK (start_date <= end_date)
);

-- Public holidays table
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Closed dates table
CREATE TABLE closed_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_closed_date_range CHECK (start_date <= end_date)
);

-- Birthdays table
CREATE TABLE birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_transactions_from_user ON transactions(from_user_id);
CREATE INDEX idx_transactions_to_user ON transactions(to_user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_debt_transactions_v2_timestamp ON debt_transactions_v2(timestamp DESC);
CREATE INDEX idx_debt_recurrence_templates_active ON debt_recurrence_templates(active) WHERE active = TRUE;
CREATE INDEX idx_debt_recurrence_occurrences_template ON debt_recurrence_occurrences(template_id);
CREATE INDEX idx_debt_weekly_recurrence_templates_active ON debt_weekly_recurrence_templates(active) WHERE active = TRUE;
CREATE INDEX idx_debt_weekly_recurrence_occurrences_template ON debt_weekly_recurrence_occurrences(template_id);
CREATE INDEX idx_leave_records_user ON leave_records(user_id);
CREATE INDEX idx_leave_records_dates ON leave_records(start_date, end_date);
CREATE INDEX idx_public_holidays_date ON public_holidays(date);
CREATE INDEX idx_closed_dates_range ON closed_dates(start_date, end_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_records_updated_at BEFORE UPDATE ON leave_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_public_holidays_updated_at BEFORE UPDATE ON public_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_closed_dates_updated_at BEFORE UPDATE ON closed_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_birthdays_updated_at BEFORE UPDATE ON birthdays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debt_recurrence_templates_updated_at BEFORE UPDATE ON debt_recurrence_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debt_weekly_recurrence_templates_updated_at BEFORE UPDATE ON debt_weekly_recurrence_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default users (passwords will be hashed in application)
-- Note: Do NOT insert placeholder password hashes here.
-- Default users are created by `src/scripts/setupDatabase.ts`.

COMMENT ON TABLE users IS 'Stores user authentication and profile information';
COMMENT ON TABLE transactions IS 'Records money transfers between users';
COMMENT ON TABLE debt_transactions_v2 IS 'Transaction-based debt tracking for Lev, Danik, and 2Masters';
COMMENT ON TABLE debt_recurrence_templates IS 'Global monthly templates for automated debt_transactions_v2 inserts';
COMMENT ON TABLE debt_recurrence_occurrences IS 'One row per template per calendar month for idempotent generation';
COMMENT ON TABLE debt_weekly_recurrence_templates IS 'Global weekly templates for automated debt_transactions_v2 inserts (day_of_week: 1=Mon … 7=Sun)';
COMMENT ON TABLE debt_weekly_recurrence_occurrences IS 'One row per template per occurrence date for idempotent generation';
COMMENT ON TABLE leave_records IS 'Tracks employee leave with business day calculations';
COMMENT ON TABLE public_holidays IS 'Stores nationally recognized holidays';
COMMENT ON TABLE closed_dates IS 'Stores company closure periods';
COMMENT ON TABLE birthdays IS 'Stores employee birthdays for age calculation';
