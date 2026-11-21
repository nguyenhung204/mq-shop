import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { SECURITY_HEADERS } from "./security-headers";
import { withoutQueryParam } from "./url-params";
import { inviteTokenFromQuery, keepInviteToken, registerReferral } from "./sub-accounts/model";

describe("global response headers", () => {
  it("the Next config applies them to every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe("/:path*");
    const h = Object.fromEntries(rules[0]!.headers.map((x) => [x.key, x.value]));
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
  });
  it("only those two: no full CSP that could break the app", () => {
    expect(SECURITY_HEADERS.map((x) => x.key).sort()).toEqual(["Content-Security-Policy", "Referrer-Policy"]);
    for (const bad of ["script-src", "default-src", "img-src", "style-src", "connect-src"]) {
      expect(SECURITY_HEADERS.map((x) => x.value).join(" ")).not.toContain(bad);
    }
  });
  it("the existing redirects are still there", async () => {
    const r = await nextConfig.redirects!();
    expect(r.map((x) => x.source)).toContain("/register");
  });
});

describe("withoutQueryParam", () => {
  it("removes only the named parameter and keeps the others and the hash", () => {
    expect(withoutQueryParam("https://s.example/my-account/register?invite=T0K&ref=R1#top", "invite")).toBe("https://s.example/my-account/register?ref=R1#top");
    expect(withoutQueryParam("/my-account/register?ref=R1&invite=T0K", "invite")).toBe("/my-account/register?ref=R1");
    expect(withoutQueryParam("/my-account/register?invite=T0K", "invite")).toBe("/my-account/register");
  });
  it("leaves a URL without the parameter untouched (same string)", () => {
    for (const u of ["/my-account/register?ref=R1", "/my-account/register", "https://s.example/x?a=1#h"]) expect(withoutQueryParam(u, "invite")).toBe(u);
  });
  it("removes every repeat of the parameter and an encoded token", () => {
    expect(withoutQueryParam("/r?invite=a&invite=b&x=1", "invite")).toBe("/r?x=1");
    expect(withoutQueryParam("/r?invite=a%2Fb%2Bc", "invite")).toBe("/r");
  });
});

describe("the invite token survives the removal from the URL", () => {
  it("first render keeps it; a later render without it still has it; a new one replaces it", () => {
    const first = keepInviteToken(undefined, inviteTokenFromQuery("TOK"));
    expect(first.token).toBe("TOK");
    const afterStrip = keepInviteToken(first.kept, inviteTokenFromQuery(null));
    expect(afterStrip.token).toBe("TOK");
    expect(keepInviteToken(afterStrip.kept, "OTHER").token).toBe("OTHER");
    expect(keepInviteToken(undefined, undefined).token).toBeUndefined();
  });
  it("the register body still carries the kept token and keeps the referral rule", () => {
    const { token } = keepInviteToken("TOK", undefined);
    expect(registerReferral(token, "REF")).toEqual({ inviteToken: "TOK" });
    expect(registerReferral(undefined, "REF")).toEqual({ referrerCode: "REF" });
  });
});
