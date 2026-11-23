import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./client";
import { getErrorMessage } from "@/lib/queries/utils";

const rejection = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e: unknown) => e as ApiError,
  );
const fetchMock = vi.fn();

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const invalidCreds = {
  statusCode: 401,
  error: "INVALID_CREDENTIALS",
  message: "Invalid email or password",
  data: { code: "INVALID_CREDENTIALS" },
};

describe("apiRequest 401 handling on public auth routes", () => {
  it.each([
    "/auth/login",
    "/auth/register",
    "/auth/register/verify-otp",
    "/auth/register/resend-otp",
    "/auth/forgot-password/request-otp",
    "/auth/forgot-password/reset",
  ])("POST %s: 401 keeps the backend code, no refresh call", async (path) => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, invalidCreds));
    const err = await rejection(apiRequest(path, { method: "POST", body: {} }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("INVALID_CREDENTIALS");
    expect(err.message).toBe("Invalid email or password");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain("/auth/refresh");
  });

  it("login 401 is shown as invalid credentials, not session expired (en/vi/zh-TW)", async () => {
    fetchMock.mockResolvedValue(jsonRes(401, invalidCreds));
    const err = await rejection(apiRequest("/auth/login", { method: "POST", body: {} }));
    expect(getErrorMessage(err, "x", "en")).toBe("Invalid email or password.");
    expect(getErrorMessage(err, "x", "vi")).toBe("Email hoặc mật khẩu không đúng.");
    expect(getErrorMessage(err, "x", "zh-TW")).toBe("電子郵件或密碼不正確。");
  });

  // Boundary of the public-route pattern: anything that is NOT a public pre-session route must keep the refresh path.
  it.each([
    "/auth/logout",
    "/auth/loginXYZ",
    "/auth/register-admin",
    "/auth/verify-otp",
    "/auth/sub-account",
    "/x?next=/auth/login",
    "/orders?redirect=/auth/login",
  ])("401 on %s is NOT treated as a public route: it still tries the refresh first", async (path) => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(401, { message: "Unauthorized" }))
      .mockResolvedValueOnce(jsonRes(401, {}));
    await rejection(apiRequest(path, { method: "POST", body: {} }));
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/auth/refresh");
  });

  it.each([
    "/auth/login?x=1",
    "/auth/login/",
    "auth/login",
    "/auth/sub-account/decline",
    "http://localhost:3005/api/v1/auth/login",
  ])("401 on %s is a public route: no refresh call", async (path) => {
    fetchMock.mockResolvedValueOnce(jsonRes(401, invalidCreds));
    const err = await rejection(apiRequest(path, { method: "POST", body: {} }));
    expect(err.code).toBe("INVALID_CREDENTIALS");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an ordinary protected route still refreshes then reports UNAUTHORIZED", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonRes(401, { message: "Unauthorized" }))
      .mockResolvedValueOnce(jsonRes(401, {}));
    const err = await rejection(apiRequest("/orders", {}));
    expect(err.status).toBe(401);
    expect(err.message).toBe("UNAUTHORIZED");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/auth/refresh");
  });
});
