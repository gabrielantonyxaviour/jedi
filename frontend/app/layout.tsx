import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jedi | Build your AI co-founder",
  description: "Build your AI co-founder",
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
