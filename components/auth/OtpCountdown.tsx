"use client";

import { useEffect } from "react";
import { OTP_TTL_SECONDS, useOtpCountdown } from "@/components/auth/useOtpCountdown";
import { useLanguage } from "@/components/providers/LanguageProvider";

type OtpCountdownProps = {
  /** Bump to restart the timer (e.g. after resend). */
  resetKey?: number;
  ttlSeconds?: number;
  className?: string;
  onExpireChange?: (expired: boolean) => void;
};

export function OtpCountdown({
  resetKey = 0,
  ttlSeconds = OTP_TTL_SECONDS,
  className = "",
  onExpireChange,
}: OtpCountdownProps) {
  const { t } = useLanguage();
  const { remaining, expired, progress, label } = useOtpCountdown(ttlSeconds, resetKey);
  const urgency =
    expired ? "is-expired" : remaining <= 60 ? "is-critical" : remaining <= 180 ? "is-warn" : "";
  const [minutes, seconds] = (expired ? "00:00" : label).split(":");

  useEffect(() => {
    onExpireChange?.(expired);
  }, [expired, onExpireChange]);

  return (
    <div
      className={`mq-otp-timer ${urgency} ${className}`.trim()}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={
        expired
          ? t("account.otp.ariaExpired")
          : t("account.otp.ariaExpires", { time: label })
      }
    >
      <p className="mq-otp-timer-label">
        {expired ? t("account.otp.codeExpired") : t("account.otp.timeRemaining")}
      </p>

      <div className="mq-otp-timer-display" data-otp-clock>
        <span className="mq-otp-timer-unit">
          <span className="mq-otp-timer-digits">{minutes}</span>
          <span className="mq-otp-timer-unit-label">{t("account.otp.minutes")}</span>
        </span>
        <span className="mq-otp-timer-colon" aria-hidden="true">
          :
        </span>
        <span className="mq-otp-timer-unit">
          <span className="mq-otp-timer-digits">{seconds}</span>
          <span className="mq-otp-timer-unit-label">{t("account.otp.seconds")}</span>
        </span>
      </div>

      <div className="mq-otp-timer-track" aria-hidden="true">
        <div
          className="mq-otp-timer-fill"
          style={{ transform: `scaleX(${expired ? 0 : progress})` }}
        />
      </div>

      <p className="mq-otp-timer-hint">
        {expired
          ? t("account.otp.hintExpired")
          : t("account.otp.hintActive", {
              minutes: String(Math.ceil(ttlSeconds / 60)),
            })}
      </p>
    </div>
  );
}
