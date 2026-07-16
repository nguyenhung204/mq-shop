import { Suspense } from "react";
import { VerifyOtpContent } from "@/components/pages/VerifyOtpContent";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="mq-container py-20 text-center text-sm text-mq-text-muted">Loading…</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
