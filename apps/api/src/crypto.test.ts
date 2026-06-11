import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken } from "./crypto.js";

describe("token encryption", () => {
  it("roundtrips a value", () => {
    const plain = "ghp_secret_value_123";
    const enc = encryptToken(plain);
    expect(enc).not.toBe(plain);
    expect(enc.split(":")).toHaveLength(3);
    expect(decryptToken(enc)).toBe(plain);
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("returns null for malformed input", () => {
    expect(decryptToken("not-valid")).toBeNull();
    expect(decryptToken("a:b:c")).toBeNull();
  });
});
