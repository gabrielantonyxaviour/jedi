import type { Metadata } from "next";
import "./globals.css";
import "@tomo-inc/tomo-evm-kit/styles.css";
import Layout from "@/components/layout";
import { TomoProvider } from "@/components/tomo-provider";

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
      <body>
        <TomoProvider>
          <Layout>{children}</Layout>
        </TomoProvider>
      </body>
    </html>
  );
}
