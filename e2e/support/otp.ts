import fs from "node:fs";
import { BACKEND_LOG } from "./env";

const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

/** Newest plaintext OTP the backend logged for `email` (OTP_LOG_PLAINTEXT=1 in the E2E env). Polls the log until found. */
export async function latestOtp(email: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const text = strip(fs.existsSync(BACKEND_LOG) ? fs.readFileSync(BACKEND_LOG, "utf8") : "");
    const re = /Dev OTP \([^)]*\) for (\S+): (\d{6})/g; // "[OtpService] Dev OTP (register) for a@b.c: 123456"
    let m: RegExpExecArray | null; let found: string | null = null;
    while ((m = re.exec(text))) if (m[1].toLowerCase() === email.toLowerCase()) found = m[2];
    if (found) return found;
    if (Date.now() > deadline) throw new Error(`no OTP in backend log for ${email}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
