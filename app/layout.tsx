import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swasthya Sutradhar",
  description: "Evidence-to-action operations for PHCs and CHCs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
