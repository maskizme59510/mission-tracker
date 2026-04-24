import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mission Tracker",
  description: "Suivi des missions consultants IT en regie",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
