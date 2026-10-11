import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import AppScript from "./app-script";

const SITE = "https://account-hudaldaa.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "GameAccount.Vercel - Made By NoVa",
  description: "Тоглоомын аккаунт худалдааны платформ",
  formatDetection: { telephone: true },
  manifest: "/manifest.json",
  icons: {
    icon: "/account-hudaldaa-logo.png",
    apple: "/account-hudaldaa-logo.png",
  },
  openGraph: {
    type: "website",
    url: SITE,
    title: "ACCOUNT HUDALDAA",
    description: "Тоглоомын аккаунт худалдааны платформ",
    images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ACCOUNT HUDALDAA",
    description: "Тоглоомын аккаунт худалдааны платформ",
    images: [`${SITE}/og-image.png`],
  },
  appleWebApp: {
    capable: true,
    title: "GameAccount",
    statusBarStyle: "black-translucent",
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="mn">
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* 1. Supabase CDN */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
          strategy="beforeInteractive"
        />
        {/* 2. Өөрийн скрипт (public/script.js) — app-script.tsx ачаална */}
        <AppScript />
      </body>
    </html>
  );
}