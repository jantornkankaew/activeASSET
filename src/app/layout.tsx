import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/auth/Providers";
import { SimpleAuthProvider } from "@/components/auth/SimpleAuth";
import { PWARegister } from "@/components/pwa/PWARegister";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* Pre-compiled Tailwind v3 CSS (avoids oxide native binary that crashes in sandbox) */}
        <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <SimpleAuthProvider>
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
