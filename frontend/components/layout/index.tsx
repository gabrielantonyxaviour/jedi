"use client";

import Header from "./header";
import Footer from "./footer";
import Sheets from "./sheets";
import { useProjects } from "@/hooks/use-projects";
import { useAccount } from "wagmi";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
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
