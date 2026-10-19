import { Timestamp } from "@google-cloud/firestore";

export type TimeLike = Date | Timestamp | string | null | undefined;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(value: TimeLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function toIso(value: TimeLike): string | null {
  return toDate(value)?.toISOString() ?? null;
}

/**
 * The pilot term starts on whichever of activation and payment happens second,
 * because PILOT_OFFER.md has the owner verify activation before sending the
 * payment link. Null until both have happened: a term that never began cannot expire.
 */
export function computeExpiresAt(
  activatedAt: TimeLike,
  paidAt: TimeLike,
  termDays: number,
): Date | null {
  const activated = toDate(activatedAt);
  const paid = toDate(paidAt);
  if (!activated || !paid) return null;
  const start = activated.getTime() >= paid.getTime() ? activated : paid;
  return new Date(start.getTime() + termDays * DAY_MS);
}

export function isExpired(expiresAt: TimeLike, now: Date = new Date()): boolean {
  const expiry = toDate(expiresAt);
  if (!expiry) return false;
  return now.getTime() > expiry.getTime();
}
