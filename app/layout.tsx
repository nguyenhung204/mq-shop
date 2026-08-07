import type { Metadata } from "next";
import { Figtree, Nunito_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { FlyToCartProvider } from "@/components/cart/FlyToCartProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { RegionBridge } from "@/components/providers/RegionBridge";
import { WishlistProvider } from "@/components/providers/WishlistProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { AppToaster } from "@/components/ui/AppToaster";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
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
    <html lang="en" className={`${nunitoSans.variable} ${figtree.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col antialiased font-sans">
        <QueryProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <RegionBridge>
                  <NotificationProvider>
                    <WishlistProvider>
                      <CartProvider>
                        <FlyToCartProvider>
                          <AppShell>{children}</AppShell>
                          <AppToaster />
                        </FlyToCartProvider>
                      </CartProvider>
                    </WishlistProvider>
                  </NotificationProvider>
                </RegionBridge>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
