import { describe, it, expect } from "vitest";
import { roleAtLeast, roleRank } from "./roles.js";

describe("workspace roles", () => {
  it("orders privileges owner > admin > member > viewer", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("member"));
    expect(roleRank("member")).toBeGreaterThan(roleRank("viewer"));
  });

  it("roleAtLeast is inclusive and respects the hierarchy", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "admin")).toBe(true);
    expect(roleAtLeast("member", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "member")).toBe(false);
    expect(roleAtLeast("member", "viewer")).toBe(true);
  });

  it("unknown roles are treated as no privileges", () => {
    expect(roleRank("bogus")).toBe(0);
    expect(roleAtLeast("bogus", "viewer")).toBe(true); // viewer rank is 0
    expect(roleAtLeast("bogus", "member")).toBe(false);
  });
});
