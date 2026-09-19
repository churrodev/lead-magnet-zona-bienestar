CREATE TABLE IF NOT EXISTS zca_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  consent_at timestamptz NOT NULL,
  consent_version text NOT NULL,
  consent_source text NOT NULL,
  purchased_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  next_email_number smallint NOT NULL DEFAULT 1 CHECK (next_email_number BETWEEN 1 AND 6),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  claim_id uuid,
  claim_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zca_leads_email_lower_unique
  ON zca_leads (lower(email));

CREATE INDEX IF NOT EXISTS zca_leads_due_index
  ON zca_leads (next_send_at)
  WHERE purchased_at IS NULL AND unsubscribed_at IS NULL AND completed_at IS NULL AND paused_at IS NULL;

CREATE TABLE IF NOT EXISTS zca_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES zca_leads(id) ON DELETE CASCADE,
  sequence_step smallint NOT NULL CHECK (sequence_step BETWEEN 1 AND 6),
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown')),
  idempotency_key text NOT NULL UNIQUE,
  resend_email_id text,
  attempt_started_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 1,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, sequence_step)
);

CREATE TABLE IF NOT EXISTS zca_purchase_events (
  provider_event_id text PRIMARY KEY,
  email text NOT NULL,
  purchased_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
