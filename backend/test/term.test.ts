import { Timestamp } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { computeExpiresAt, isExpired, toIso, DAY_MS } from "../src/lib/term.js";

const activated = new Date("2026-08-01T10:00:00.000Z");
const paid = new Date("2026-08-04T09:00:00.000Z");

describe("pilot term", () => {
  it("returns null until the licence is both activated and paid", () => {
    expect(computeExpiresAt(activated, null, 30)).toBeNull();
    expect(computeExpiresAt(null, paid, 30)).toBeNull();
    expect(computeExpiresAt(null, null, 30)).toBeNull();
  });

  it("starts the term at whichever of activation and payment happens second", () => {
    const payLast = computeExpiresAt(activated, paid, 30);
    const activateLast = computeExpiresAt(paid, activated, 30);
    expect(payLast).toEqual(new Date(paid.getTime() + 30 * DAY_MS));
    expect(activateLast).toEqual(new Date(paid.getTime() + 30 * DAY_MS));
  });

  it("accepts Firestore timestamps and ISO strings alike", () => {
    const fromTimestamp = computeExpiresAt(
      Timestamp.fromDate(activated),
      Timestamp.fromDate(paid),
      30,
    );
    const fromStrings = computeExpiresAt(activated.toISOString(), paid.toISOString(), 30);
    expect(fromTimestamp).toEqual(fromStrings);
  });

  it("expires strictly after the expiry instant", () => {
    const expiry = new Date("2026-09-03T09:00:00.000Z");
    expect(isExpired(expiry, new Date(expiry.getTime() - 1))).toBe(false);
    expect(isExpired(expiry, expiry)).toBe(false);
    expect(isExpired(expiry, new Date(expiry.getTime() + 1))).toBe(true);
  });

  it("treats a missing expiry as never expiring", () => {
    expect(isExpired(null, new Date("2099-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("converts to ISO or null", () => {
    expect(toIso(Timestamp.fromDate(activated))).toBe(activated.toISOString());
    expect(toIso(null)).toBeNull();
    expect(toIso("not a date")).toBeNull();
  });
});

describe("no-fee grants never expire", () => {
  it("computes no expiry when a licence was activated but never paid", () => {
    const activated = new Date("2026-08-14T10:00:00Z");
    expect(computeExpiresAt(activated, null, 30)).toBeNull();
  });

  it("treats a null expiry as not expired, however long ago it was activated", () => {
    const longAfter = new Date("2030-01-01T00:00:00Z");
    expect(isExpired(null, longAfter)).toBe(false);
    expect(isExpired(undefined, longAfter)).toBe(false);
  });
});
