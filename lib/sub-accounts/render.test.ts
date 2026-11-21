import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateSubAccountForm, InviteTable, NewInviteBox, SubAccountTable } from "@/components/sub-accounts/parts";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { InviteItem, SubAccountItem } from "@/lib/api/sub-accounts";

const wrap = (n: React.ReactElement) => renderToStaticMarkup(createElement(LanguageProvider, null, n));

describe("CreateSubAccountForm", () => {
  const form = (props: Partial<Parameters<typeof CreateSubAccountForm>[0]> = {}) =>
    wrap(createElement(CreateSubAccountForm, { admin: false, onSubmit: () => true, ...props }));
  it("owner: e-mail, name, region and the pending explanation, no reason box", () => {
    const html = form();
    expect(html).toContain('type="email"');
    expect(html).toContain("subAccounts.create.ownerExplain");
    expect(html).not.toContain("<textarea");
    for (const r of ["TW", "VN", "MY", "SG"]) expect(html).toContain(`value="${r}"`);
    expect(html).not.toContain('value="US"');
  });
  it("admin: the reason box and the 'active immediately' explanation", () => {
    const html = form({ admin: true });
    expect(html).toContain("<textarea");
    expect(html).toContain("subAccounts.create.adminExplain");
    expect(html).not.toContain("subAccounts.create.ownerExplain");
  });
  it("at the cap the owner cannot submit and sees why; an admin still can", () => {
    expect(form({ atCap: true })).toMatch(/<button[^>]*type="submit"[^>]*disabled|<button[^>]*disabled[^>]*type="submit"/);
    expect(form({ atCap: true })).toContain("subAccounts.create.atCap");
    expect(form({ atCap: true, admin: true })).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });
  it("busy disables every field", () => {
    const html = form({ busy: true });
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toContain("admin.common.working");
  });
});

const item = (over: Partial<SubAccountItem> = {}): SubAccountItem => ({
  id: "s1", email: "kid@x.co", fullName: "Kid", status: "ACTIVE", regionCode: "VN", subAccountCount: 0, createdAt: "2026-11-01T00:00:00Z", ...over,
});

describe("SubAccountTable", () => {
  const table = (items: SubAccountItem[], withAction = true) =>
    wrap(createElement(SubAccountTable, { items, actionLabelKey: withAction ? "subAccounts.withdraw" : undefined, onAction: withAction ? () => {} : undefined }));
  it("a pending account shows its status, the 7-day hint and the withdraw button; an active one does not", () => {
    const html = table([item({ id: "p", status: "PENDING_ACTIVATION", email: "p@x.co" }), item()]);
    expect(html).toContain("subAccounts.pendingHint");
    expect(html.match(/subAccounts\.withdraw/g)?.length).toBe(1);
    expect(html).toContain("p@x.co");
  });
  it("no action label, no button (read-only staff)", () => {
    expect(table([item({ status: "PENDING_ACTIVATION" })], false)).not.toContain("subAccounts.withdraw");
  });
  it("a LOCKED account is not offered the withdraw action", () => {
    expect(table([item({ status: "LOCKED" })])).not.toContain("subAccounts.withdraw");
  });
});

describe("NewInviteBox: the plaintext token is shown once and only from the creation answer", () => {
  const box = (created: { token: string | null; expiresAt?: string } | undefined) =>
    wrap(createElement(NewInviteBox, { created, origin: "https://shop.example.com", onDismiss: () => {} }));
  it("shows the register link with the token, the once warning and a copy button", () => {
    const html = box({ token: "TOPSECRET123", expiresAt: "2026-11-30T00:00:00Z" });
    expect(html).toContain("https://shop.example.com/register?invite=TOPSECRET123");
    expect(html).toContain("subAccounts.invites.onceWarning");
    expect(html).toContain("subAccounts.invites.copy");
    expect(html).toContain('readOnly=""');
  });
  it("a replayed creation (token null) shows the explanation and no link at all", () => {
    const html = box({ token: null });
    expect(html).toContain("subAccounts.invites.replayed");
    expect(html).not.toContain("invite=");
    expect(html).not.toContain("subAccounts.invites.copy\"");
  });
  it("nothing before a creation", () => {
    expect(box(undefined)).toBe("");
  });
});

describe("InviteTable", () => {
  const inv = (status: InviteItem["status"], id = status): InviteItem => ({
    id, status, expiresAt: "2026-11-30T00:00:00Z", usedByUserId: null, usedAt: null, revokedAt: null, createdAt: "2026-11-23T00:00:00Z",
  });
  it("only an open invite has a revoke button, and no token is ever rendered", () => {
    const html = wrap(createElement(InviteTable, { items: [inv("PENDING"), inv("USED"), inv("REVOKED"), inv("EXPIRED")], onRevoke: () => {} }));
    expect(html.match(/subAccounts\.invites\.revoke/g)?.length).toBe(1);
    expect(html).not.toContain("token");
    for (const s of ["PENDING", "USED", "REVOKED", "EXPIRED"]) expect(html).toContain(`subAccounts.invites.status.${s}`);
  });
  it("empty state", () => {
    expect(wrap(createElement(InviteTable, { items: [], onRevoke: () => {} }))).toContain("subAccounts.invites.empty");
  });
});
