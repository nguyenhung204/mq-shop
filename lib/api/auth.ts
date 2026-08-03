import { api } from "./client";
import type { AuthUser, LoginResponse } from "./types";

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    /** Prefill from `/my-account/register?ref=` (alias `/register?ref=`) — BE field name. */
    referrerCode?: string;
  }) =>
    api.post<{ id?: string; email?: string; status?: string; message?: string }>(
      "/auth/register",
      body,
    ),

  verifyOtp: (body: { email: string; otp: string }) =>
    api.post<LoginResponse>("/auth/register/verify-otp", body),

  /** Legacy path fallback */
  verifyOtpLegacy: (body: { email: string; code: string }) =>
    api.post("/auth/verify-otp", body),

  resendOtp: (body: { email: string }) =>
    api.post("/auth/register/resend-otp", body),

  login: async (body: { email: string; password: string } | { identifier: string; password: string }) => {
    const payload =
      "email" in body
        ? { email: body.email, password: body.password }
        : { email: body.identifier, password: body.password };
    return api.post<LoginResponse>("/auth/login", payload);
  },

  logout: () => api.post("/auth/logout", {}),

  /** Always succeeds for valid body (anti-enumeration). Mail only if ACTIVE user exists. */
  forgotPassword: (body: { email: string }) =>
    api.post("/auth/forgot-password/request-otp", body),

  /** Missing / inactive user → same INVALID_OTP as wrong code. Clears session cookies on BE. */
  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    api.post(
      "/auth/forgot-password/reset",
      { email: body.email, code: body.code, newPassword: body.newPassword },
    ),

  me: () => api.get<AuthUser>("/users/me"),

  updateProfile: (body: { fullName?: string }) =>
    api.patch<AuthUser>("/users/me", body),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("avatar", file);
    return api.postForm<AuthUser>("/users/me/avatar", fd);
  },

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.patch("/users/me/password", body),

  requestEmailOtp: (body: { newEmail: string }) =>
    api.post("/users/me/email/request-otp", body),

  confirmEmailChange: (body: { email: string; otp: string }) =>
    api.post("/users/me/email/verify-otp", body),
};
