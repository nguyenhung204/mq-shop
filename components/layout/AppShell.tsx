"use client";

import type { ReactNode } from "react";
import { LanguageGate } from "@/components/i18n/LanguageGate";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TopBar } from "@/components/layout/TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, needsSelection } = useLanguage();

  return (
    <>
      <LanguageGate />
      {ready && !needsSelection && (
        <>
          <TopBar />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </>
      )}
    </>
  );
}
