import { Suspense } from "react";
import { DeclineSubAccountContent } from "@/components/pages/DeclineSubAccountContent";

export const metadata = { title: "Decline account" };

export default function DeclineSubAccountPage() {
  return (
    <Suspense fallback={null}>
      <DeclineSubAccountContent />
    </Suspense>
  );
}
