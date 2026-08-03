-- Weekly debt recurrence (run once on existing databases)
-- Safe to run multiple times where IF NOT EXISTS applies

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
);

CREATE TABLE IF NOT EXISTS debt_weekly_recurrence_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES debt_weekly_recurrence_templates(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  transaction_id UUID NOT NULL REFERENCES debt_transactions_v2(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_debt_weekly_recurrence_templates_active
  ON debt_weekly_recurrence_templates(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_debt_weekly_recurrence_occurrences_template
  ON debt_weekly_recurrence_occurrences(template_id);

DROP TRIGGER IF EXISTS update_debt_weekly_recurrence_templates_updated_at ON debt_weekly_recurrence_templates;
CREATE TRIGGER update_debt_weekly_recurrence_templates_updated_at BEFORE UPDATE ON debt_weekly_recurrence_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE debt_weekly_recurrence_templates IS 'Global weekly templates for automated debt_transactions_v2 inserts (day_of_week: 1=Mon … 7=Sun)';
COMMENT ON TABLE debt_weekly_recurrence_occurrences IS 'One row per template per occurrence date for idempotent generation';
