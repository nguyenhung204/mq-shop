import { api, clearTokens, setTokens } from "./client";
import type { AuthUser, LoginResponse } from "./types";

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    phone?: string;
    fullName?: string;
    referralCode?: string;
  }) =>
    api.post<{ id: string; email: string; status: string; message?: string }>(
      "/auth/register",
      body,
      { auth: false },
    ),

  verifyOtp: (body: { email: string; code: string }) =>
    api.post("/auth/verify-otp", body, { auth: false }),

  login: async (body: { identifier: string; password: string }) => {
    const data = await api.post<LoginResponse>("/auth/login", body, { auth: false });
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  logout: async () => {
    try {
      await api.post("/auth/logout", {});
    } finally {
      clearTokens();
    }
  },

  forgotPassword: (body: { email: string }) =>
    api.post("/auth/forgot-password", body, { auth: false }),

  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    api.post("/auth/reset-password", body, { auth: false }),

  me: () => api.get<AuthUser>("/users/me"),

  updateProfile: (body: { fullName?: string; avatarUrl?: string; dateOfBirth?: string }) =>
    api.put<AuthUser>("/users/me/profile", body),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put("/users/me/password", body),

  requestEmailOtp: (body: { newEmail: string }) =>
    api.post("/users/me/change-email/request-otp", body),

  confirmEmailChange: (body: { code: string }) =>
    api.put("/users/me/change-email/confirm", body),
};
