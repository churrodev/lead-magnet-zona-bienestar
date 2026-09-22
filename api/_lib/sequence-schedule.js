const DAILY_CRON_DUE_HOUR_UTC = 12;
const FIRST_EMAIL_DELAY_MS = 10 * 60 * 1000;
const FOLLOW_UP_DELAY_MS = 24 * 60 * 60 * 1000;

function validDate(reference) {
  const date = reference instanceof Date ? reference : new Date(reference);
  if (Number.isNaN(date.getTime())) throw new TypeError("A valid reference date is required");
  return date;
}

export function firstEmailScheduledAt(reference = new Date()) {
  return new Date(validDate(reference).getTime() + FIRST_EMAIL_DELAY_MS);
}

export function nextEmailDueAt(reference = new Date()) {
  return new Date(validDate(reference).getTime() + FOLLOW_UP_DELAY_MS);
}

export function nextDailyCronDueAt(reference = new Date()) {
  const date = validDate(reference);

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
