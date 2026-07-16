import { Suspense } from "react";
import { MyAccountContent } from "@/components/pages/MyAccountContent";

export const metadata = { title: "My Account" };

export default function MyAccountPage() {
  return (
    <Suspense fallback={<div className="mq-container py-20 text-center text-sm text-mq-text-muted">Loading…</div>}>
      <MyAccountContent />
    </Suspense>
  );
}
