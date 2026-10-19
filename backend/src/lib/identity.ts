import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import { ApiError } from "../errors.js";
import type { AppConfig } from "../config.js";
import type { AuthenticatedUser } from "../types.js";
import { logEvent } from "./log.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface IdentityVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

/**
 * The one definition of how an identity value becomes a stored hash.
 * The provisioning script and the Stripe webhook must produce byte-identical
 * hashes or a paid licence will never be found for its customer.
 */
export function hashIdentityValue(value: string, salt: string): string {
  return createHash("sha256").update(`${value}:${salt}`, "utf8").digest("hex");
}

export function identityFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("wrong recipient") || message.includes("audience")) return "audience";
  if (message.includes("issuer")) return "issuer";
  if (
    message.includes("too early") ||
    message.includes("too late") ||
    message.includes("expiration") ||
    message.includes("issue time") ||
    message.includes("iat field") ||
    message.includes("exp field")
  ) {
    return "time";
  }
  if (
    message.includes("no pem") ||
    message.includes("signature") ||
    message.includes("token envelope")
  ) {
    return "signature";
  }
  if (
    message.includes("certificate") ||
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econn")
  ) {
    return "certificate_fetch";
  }
  if (message.includes("segments") || message.includes("token payload")) return "malformed";
  return "other";
}

function audienceDiagnostic(
  token: string,
  expected: string,
): {
  audienceMatch: boolean;
  expectedLength: number;
  receivedLength: number | null;
  expectedHash: string;
  receivedHash: string | null;
} {
  let received: string | null = null;
  try {
    const payloadPart = token.split(".")[1];
    if (payloadPart) {
      const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
        aud?: unknown;
      };
      if (typeof payload.aud === "string") received = payload.aud;
    }
  } catch {
    received = null;
  }
  const shortHash = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
  return {
    audienceMatch: received === expected,
    expectedLength: expected.length,
    receivedLength: received === null ? null : received.length,
    expectedHash: shortHash(expected),
    receivedHash: received === null ? null : shortHash(received),
  };
}

export class GoogleIdentityVerifier implements IdentityVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: AppConfig) {}

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.config.ONWAN_OAUTH_AUDIENCE,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified === false) {
        throw new ApiError(401, "INVALID_IDENTITY", "A verified Google account is required.");
      }
      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        uidHash: hashIdentityValue(payload.sub, this.config.ONWAN_ID_HASH_SALT),
        emailHash: hashIdentityValue(payload.email.toLowerCase(), this.config.ONWAN_ID_HASH_SALT),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logEvent("WARNING", "identity_rejected", {
        reason: identityFailureCategory(error),
        ...audienceDiagnostic(token, this.config.ONWAN_OAUTH_AUDIENCE),
      });
      throw new ApiError(401, "INVALID_IDENTITY", "A verified Google account is required.");
    }
  }
}

export function identityMiddleware(verifier: IdentityVerifier): RequestHandler {
  return async (request, _response, next) => {
    try {
      const header = request.header("authorization") || "";
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match?.[1]) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with Google to continue.");
      request.user = await verifier.verify(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
