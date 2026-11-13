import { describe, expect, it } from "vitest";
import { hasDeadBranchMarker, stripComments } from "./strip-comments";

describe("stripComments", () => {
  it("removes line and block comments but keeps string contents", () => {
    const out = stripComments('const a = "https://x.y"; // canShow(user)\n/* canShow(user) */ const b = 1;');
    expect(out).toContain('"https://x.y"');
    expect(out).not.toContain("canShow");
    expect(out).toContain("const b = 1;");
  });
  it("detects dead-branch markers", () => {
    expect(hasDeadBranchMarker("if (false) { x() }")).toBe(true);
    expect(hasDeadBranchMarker("false && x()")).toBe(true);
    expect(hasDeadBranchMarker("if (ok) { x() }")).toBe(false);
  });
});
