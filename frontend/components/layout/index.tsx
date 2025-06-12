"use client";

import Header from "./header";
import Footer from "./footer";
import Sheets from "./sheets";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full h-screen overflow-hidden bg-black relative">
      <Header />
      {children}
      <Sheets />
      <Footer />
    </main>
  );
}
