-- The sequence includes every consenting lead; only unsubscribed or otherwise
-- completed/paused leads are excluded from the daily due queue.
CREATE INDEX IF NOT EXISTS zca_leads_due_all_opted_index
  ON zca_leads (next_send_at)
  WHERE unsubscribed_at IS NULL AND completed_at IS NULL AND paused_at IS NULL;
