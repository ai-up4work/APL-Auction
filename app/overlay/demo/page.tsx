// app/overlay/demo/page.tsx
import PointsTable from "@/components/overlays/PointsTable";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <PointsTable />
        </div>
    );
}