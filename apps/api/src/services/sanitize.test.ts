import { describe, it, expect } from "vitest";
import { redactSecrets } from "./sanitize.js";

describe("redactSecrets", () => {
  it("redacts the password in a connection string but keeps the shape", () => {
    const out = redactSecrets("Connect with postgres://memmo:s3cr3t@localhost:5455/memmo");
    expect(out).toContain("postgres://memmo:[redacted]@localhost:5455");
    expect(out).not.toContain("s3cr3t");
  });

  it("redacts secret-named assignments (quoted or not)", () => {
    expect(redactSecrets("POSTGRES_PASSWORD=memmo")).toBe("POSTGRES_PASSWORD=[redacted]");
    expect(redactSecrets('export API_KEY: "abc123def"')).toContain("API_KEY: [redacted]");
    expect(redactSecrets("CLIENT_SECRET = zzz")).toContain("CLIENT_SECRET = [redacted]");
  });

  it("redacts bearer tokens and known token shapes", () => {
    expect(redactSecrets("Authorization: Bearer memmo_abcdef123456")).not.toContain("memmo_abcdef");
    expect(redactSecrets("token ghp_0123456789abcdefghij")).toContain("[redacted]");
    expect(redactSecrets("AKIAIOSFODNN7EXAMPLE is the key")).toContain("[redacted]");
  });

  it("redacts private key blocks", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(`key: ${pem}`)).not.toContain("MIIabc");
  });

  it("leaves ordinary durable knowledge untouched", () => {
    const text = "Run `make test-billing` for billing changes; the full suite times out.";
    expect(redactSecrets(text)).toBe(text);
  });

  it("does not redact a non-secret name that merely contains a digit", () => {
    expect(redactSecrets("The service listens on port 8080")).toBe("The service listens on port 8080");
  });
});
