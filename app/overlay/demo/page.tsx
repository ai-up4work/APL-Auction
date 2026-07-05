// app/overlay/demo/page.tsx
import TaskNotificationPanel from "@/components/overlays/CricketMatchIntro";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <TaskNotificationPanel />
        </div>
    );
}