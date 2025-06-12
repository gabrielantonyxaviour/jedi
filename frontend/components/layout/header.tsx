"use client";

import JediLogo from "@/components/jedi-logo";
import WalletButton from "./wallet";

export default function Header() {
  return (
    <div className="absolute top-0 left-0 right-0 z-10">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-2 p-2">
          <JediLogo size={48} className="rounded-md" />
        </div>
        <WalletButton />
      </div>
    </div>
  );
}
