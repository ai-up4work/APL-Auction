// app/overlay/demo/page.tsx
import LiveScoreBar from "@/components/overlays/LiveScoreBar";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <LiveScoreBar />
        </div>
    );
}