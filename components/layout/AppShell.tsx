"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LanguageGate } from "@/components/i18n/LanguageGate";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

function isStaffShell(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/super-admin");
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, needsSelection } = useLanguage();
  const pathname = usePathname() || "";
  const staff = isStaffShell(pathname);

  return (
    <>
      <LanguageGate />
      {ready && !needsSelection && (
        <>
          {!staff && <Header />}
          <main className="flex-1">{children}</main>
          {!staff && <Footer />}
        </>
      )}
    </>
  );
}
