import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1a2613",
};

export const metadata: Metadata = {
  title: "Upstream Dashboard",
  description:
    "Operate cameras, agents, and live streams on the Upstream platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "rgba(15, 24, 9, 0.92)",
              border: "1px solid rgba(245, 241, 231, 0.14)",
              color: "var(--ink)",
              backdropFilter: "blur(22px) saturate(140%)",
            },
          }}
        />
      </body>
    </html>
  );
}
