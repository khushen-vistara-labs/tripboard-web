import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#153f34", colorScheme: "light dark" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "TripBoard";
  const description = "A private, shared trip companion for planning, tracking, tickets, and spending.";
  return {
    metadataBase: new URL(origin),
    title: { default: title, template: "%s · TripBoard" },
    description,
    applicationName: "TripBoard",
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/favicon.png", type: "image/png", sizes: "32x32" }], apple: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }] },
    appleWebApp: { capable: true, title: "TripBoard", statusBarStyle: "black-translucent" },
    openGraph: { type: "website", siteName: "TripBoard", title, description, images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "TripBoard — Your shared trip, in step." }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `try { const saved = localStorage.getItem('tripboard-theme'); document.documentElement.dataset.theme = saved === 'dark' || saved === 'light' ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { document.documentElement.dataset.theme = 'light'; }`;
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
