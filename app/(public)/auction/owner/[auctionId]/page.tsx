import { redirect } from "next/navigation";

interface AuctionOwnerPageProps {
  params: Promise<{
    auctionId: string;
  }>;
}

export default async function AuctionOwnerPage({ params }: AuctionOwnerPageProps) {
  const { auctionId } = await params;
  redirect(`/auction/owner/${auctionId}/join`);
}