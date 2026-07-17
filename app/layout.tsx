import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { AppToaster } from "@/components/ui/AppToaster";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MQ — Curated Lifestyle & Essentials",
    template: "%s | MQ",
  },
  description:
    "MQ — Premium curated goods for modern living. Accessories, apparel, home, tech, and gifts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <QueryProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <NotificationProvider>
                  <CartProvider>
                    <AppShell>{children}</AppShell>
                    <AppToaster />
                  </CartProvider>
                </NotificationProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
