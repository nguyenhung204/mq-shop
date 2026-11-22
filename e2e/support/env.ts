import path from "node:path";

export const WEB = "http://localhost:3000";
export const API = "http://localhost:3005/api/v1";
export const DB_URL = process.env.E2E_DB_URL ?? "postgres://e2e:e2e_pw_local@localhost:55432/mq_e2e";
export const REDIS_CONTAINER = "mqe2e-redis";
export const AUTH_DIR = path.join(__dirname, "..", ".auth");
export const BACKEND_LOG = process.env.E2E_BACKEND_LOG ?? path.join(__dirname, "..", ".run", "backend.log");

export const ROLES = {
  SUPER_ADMIN: { email: "superadmin@example.com", password: "Seed123456!" },
  ADMIN: { email: "admin@example.com", password: "Admin123!" },
  ACCOUNTANT: { email: "accountant@example.com", password: "Seed123456!" },
  CS: { email: "cs@example.com", password: "Seed123456!" },
  WAREHOUSE: { email: "warehouse@example.com", password: "Seed123456!" },
  SELLER: { email: "seller@example.com", password: "Seed123456!" },
  BUYER: { email: "buyer@example.com", password: "Seed123456!" },
} as const;
export type RoleName = keyof typeof ROLES;
export const DEFAULT_PASSWORD = "Seed123456!";
