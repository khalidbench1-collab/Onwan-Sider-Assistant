import { describe, expect, it } from "vitest";
import { identityFailureCategory } from "../src/lib/identity.js";

describe("identity failure diagnostics", () => {
  it("classifies verification failures without retaining raw details", () => {
    expect(identityFailureCategory(new Error("Wrong recipient, payload audience != requiredAudience")))
      .toBe("audience");
    expect(identityFailureCategory(new Error("Token used too late"))).toBe("time");
    expect(identityFailureCategory(new Error("Invalid token signature: sensitive-token"))).toBe(
      "signature",
    );
    expect(identityFailureCategory(new Error("network fetch failed"))).toBe("certificate_fetch");
  });

  it("uses a generic category for unexpected failures", () => {
    expect(identityFailureCategory(new Error("unexpected sensitive detail"))).toBe("other");
  });
});
