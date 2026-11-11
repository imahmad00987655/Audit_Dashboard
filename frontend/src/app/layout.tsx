import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * Avoid next/font/google — Docker builds on locked-down servers cannot
 * reach fonts.googleapis.com (ETIMEDOUT). CSS variables below use system
 * stacks that still keep display / body / mono distinct.
 */
export const metadata: Metadata = {
  title: "Procurement Audit Dashboard | Master Group of Industries",
  description:
    "Enterprise procurement audit analytics for Master Group of Industries.",
  applicationName: "Master Procurement Audit",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0055a5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
