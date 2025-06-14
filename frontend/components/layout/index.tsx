"use client";

import Header from "./header";
import Footer from "./footer";
import Sheets from "./sheets";
import { useAppStore } from "@/store/app-store";
import { useProjects } from "@/hooks/use-projects";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { address } = useAppStore();
  const { projects } = useProjects(address);
  return (
    <main className="w-full h-screen overflow-hidden bg-black relative">
      <Header />
      {children}
      <Sheets projects={projects} />
      <Footer />
    </main>
  );
}
