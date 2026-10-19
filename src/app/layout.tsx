import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Thai, Poppins, Prompt } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/auth/Providers";
import { SimpleAuthProvider } from "@/components/auth/SimpleAuth";
import { PWARegister } from "@/components/pwa/PWARegister";
import { ThemeProvider } from "next-themes";

// === Velzon-style typography ===
// Body: Inter (Latin) + IBM Plex Sans Thai (Thai) — clean, modern, very readable for dashboards
// Display/Headings: Poppins (Latin) + Prompt (Thai) — geometric, premium feel matching Velzon
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans-thai",
  subsets: ["thai"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const prompt = Prompt({
  variable: "--font-display-thai",
  subsets: ["thai"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "activeASSET — ระบบบริหารทรัพย์สินถาวรและเครื่องเดโม",
  description: "ระบบบริหารจัดการอุปกรณ์ Auto-ID / AIDC: Mobile Computer, Barcode Scanner, Barcode Printer, RFID Reader และ Tablet — รองรับการยืมเดโม ตรวจสภาพ ตรวจนับ และเอกสารลายเซ็นดิจิทัล",
  keywords: ["activeASSET", "Fixed Asset", "Demo Equipment", "Auto-ID", "AIDC", "Loan Management"],
  authors: [{ name: "activeASSET" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "activeASSET",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { cookies } from "next/headers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  let initialUser = null;
  const rawUser = cookieStore.get("activeasset_user")?.value;
  if (rawUser) {
    try {
      initialUser = JSON.parse(decodeURIComponent(rawUser));
    } catch {}
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* Pre-compiled Tailwind v3 CSS (avoids oxide native binary that crashes in sandbox) */}
        <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body
        className={`${inter.variable} ${ibmPlexThai.variable} ${poppins.variable} ${prompt.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SimpleAuthProvider initialUser={initialUser}>
            <Providers>
              {children}
              <Toaster />
              <PWARegister />
            </Providers>
          </SimpleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
