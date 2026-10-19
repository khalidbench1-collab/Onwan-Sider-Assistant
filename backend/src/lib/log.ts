const forbiddenKeys = new Set([
  "targettext",
  "styleprofile",
  "ideatext",
  "prompt",
  "markdown",
  "editedText",
  "email",
  "token",
  "authorization",
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      clean[key] = forbiddenKeys.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(child);
    }
    return clean;
  }
  return value;
}

export function logEvent(
  severity: "INFO" | "WARNING" | "ERROR",
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safeFields = sanitize(fields) as Record<string, unknown>;
  process.stdout.write(
    `${JSON.stringify({
      severity,
      event,
      ...safeFields,
      ts: new Date().toISOString(),
    })}\n`,
  );
}

export function sanitizeForTest(value: unknown): unknown {
  return sanitize(value);
}
