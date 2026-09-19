-- A voluntary re-consent starts a new sequence generation while retaining the
-- immutable delivery audit from earlier generations.
BEGIN;

ALTER TABLE zca_leads
  ADD COLUMN IF NOT EXISTS sequence_generation integer NOT NULL DEFAULT 1
  CHECK (sequence_generation > 0);

ALTER TABLE zca_email_sends
  ADD COLUMN IF NOT EXISTS sequence_generation integer NOT NULL DEFAULT 1
  CHECK (sequence_generation > 0);

ALTER TABLE zca_email_sends
  DROP CONSTRAINT IF EXISTS zca_email_sends_lead_id_sequence_step_key;

CREATE UNIQUE INDEX IF NOT EXISTS zca_email_sends_lead_generation_step_unique
  ON zca_email_sends (lead_id, sequence_generation, sequence_step);

COMMIT;
