import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("./client", () => ({
  api: { post: (...a: unknown[]) => post(...a), patch: vi.fn(), get: vi.fn() },
}));

import { authApi } from "./auth";

beforeEach(() => {
  post.mockReset();
});

describe("registration & verify-otp password flow", () => {
  it("authApi.register sends email/metadata without password", async () => {
    post.mockResolvedValue({ message: "OTP sent" });
    await authApi.register({
      email: "user@example.com",
      fullName: "Alice",
      referrerCode: "REF123",
      regionCode: "VN",
    });
    expect(post).toHaveBeenCalledWith("/auth/register", {
      email: "user@example.com",
      fullName: "Alice",
      referrerCode: "REF123",
      regionCode: "VN",
    });
    expect(post.mock.calls[0]![1]).not.toHaveProperty("password");
  });

  it("authApi.verifyOtp sends email, otp, and password", async () => {
    post.mockResolvedValue({ user: { id: "u1" } });
    await authApi.verifyOtp({
      email: "user@example.com",
      otp: "123456",
      password: "Password123",
    });
    expect(post).toHaveBeenCalledWith("/auth/register/verify-otp", {
      email: "user@example.com",
      otp: "123456",
      password: "Password123",
    });
  });

  it("RegisterContent has no password inputs and VerifyOtpContent has password + confirmPassword inputs", () => {
    const regSrc = readFileSync(
      resolve(__dirname, "../../components/pages/RegisterContent.tsx"),
      "utf8",
    );
    const otpSrc = readFileSync(
      resolve(__dirname, "../../components/pages/VerifyOtpContent.tsx"),
      "utf8",
    );
    expect(regSrc).not.toContain('id="reg-password"');
    expect(regSrc).not.toContain('id="reg-password-confirm"');
    expect(otpSrc).toContain('id="otp-password"');
    expect(otpSrc).toContain('id="otp-password-confirm"');
    expect(otpSrc).toContain("authApi.verifyOtp({ email, otp: code, password })");
  });
});
