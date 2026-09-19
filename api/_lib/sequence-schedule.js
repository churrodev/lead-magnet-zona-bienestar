const DAILY_CRON_DUE_HOUR_UTC = 12;

export function nextDailyCronDueAt(reference = new Date()) {
  const date = reference instanceof Date ? reference : new Date(reference);
  if (Number.isNaN(date.getTime())) throw new TypeError("A valid reference date is required");

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    DAILY_CRON_DUE_HOUR_UTC,
  ));
}

export function buildSequenceIdempotencyKey(leadId, generation, step) {
  if (!leadId || !Number.isInteger(generation) || generation < 1 || !Number.isInteger(step) || step < 1) {
    throw new TypeError("A lead id, positive generation and positive step are required");
  }

  return `zca-lead-recovery/${leadId}/${generation}/${step}`;
}
