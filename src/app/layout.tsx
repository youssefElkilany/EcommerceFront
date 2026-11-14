import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";





export const metadata: Metadata = {
  title: { default: "Dorytos", template: "%s" },
  description: "Our new online storefront.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="font-sans">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

