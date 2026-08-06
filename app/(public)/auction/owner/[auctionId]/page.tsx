// redirect to /join

import { redirect } from "next/dist/client/components/navigation";


export default function AuctionOwnerPage() {
  redirect('/join');
}