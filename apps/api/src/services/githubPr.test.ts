import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyGithubSignature, isMergedPr, prToSessionInput } from "./githubPr.js";

const SECRET = "whsec_test";
const sign = (body: Buffer) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

describe("verifyGithubSignature", () => {
  it("accepts a correct signature", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    expect(verifyGithubSignature(SECRET, body, sign(body))).toBe(true);
  });

  it("rejects a tampered body, wrong secret, or missing header", () => {
    const body = Buffer.from("a");
    expect(verifyGithubSignature(SECRET, Buffer.from("b"), sign(body))).toBe(false);
    expect(verifyGithubSignature("other", body, sign(body))).toBe(false);
    expect(verifyGithubSignature(SECRET, body, undefined)).toBe(false);
    expect(verifyGithubSignature("", body, sign(body))).toBe(false);
  });
});

describe("isMergedPr", () => {
  it("is true only for a closed+merged pull_request event", () => {
    expect(isMergedPr("pull_request", { action: "closed", pull_request: { merged: true } })).toBe(true);
    expect(isMergedPr("pull_request", { action: "closed", pull_request: { merged: false } })).toBe(false);
    expect(isMergedPr("pull_request", { action: "opened", pull_request: { merged: false } })).toBe(false);
    expect(isMergedPr("push", { action: "closed", pull_request: { merged: true } })).toBe(false);
  });
});

describe("prToSessionInput", () => {
  it("maps title→task and body→reasoning", () => {
    const input = prToSessionInput({
      pull_request: { number: 12, title: "Cache reads only", body: "Writes must stay consistent, so we only cache GETs." },
    });
    expect(input?.task).toBe("Cache reads only");
    expect(input?.summary).toContain("#12");
    expect(input?.reasoning).toContain("only cache GETs");
    expect(input?.agent).toBe("github");
  });

  it("returns null without a title", () => {
    expect(prToSessionInput({ pull_request: { number: 1 } })).toBeNull();
  });
});
