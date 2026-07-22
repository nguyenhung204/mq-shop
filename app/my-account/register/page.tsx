import { Suspense } from "react";
import { RegisterContent } from "@/components/pages/RegisterContent";

export const metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="mq-container py-20 text-center text-sm text-mq-text-muted">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
