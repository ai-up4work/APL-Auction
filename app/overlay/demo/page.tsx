// app/overlay/demo/page.tsx
import CricketScorecard from "@/components/overlays/CricketScorecard";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <CricketScorecard />
        </div>
    );
}