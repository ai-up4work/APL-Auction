"use client";

import { useRouter } from "next/navigation";
import AuctionPicker from "@/components/Admin/AuctionPicker";
import { useAuction } from "@/context/AuctionContext";

export default function AdminPickerPage() {
  const router = useRouter();
  const { createNew, isHydrated } = useAuction();

  function handleCreateNew(name?: string) {
    const id = createNew(name || ""); // assumes createNew returns the new auctionId
    router.push(`/auction/admin/${id}`);
  }

  function handleSelectAuction(id: string) {
    router.push(`/auction/admin/${id}`);
  }

  if (!isHydrated) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: "var(--color-background)", color: "var(--color-outline)" }}
      >
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 28 }}>
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <AuctionPicker
      onCreateNew={handleCreateNew}
      onSelectAuction={handleSelectAuction}
    />
  );
}