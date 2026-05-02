import type { Metadata, Viewport } from "next";
import { MobileShell } from "@/components/shell/MobileShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wiki",
  description: "Personal wiki",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wiki",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
