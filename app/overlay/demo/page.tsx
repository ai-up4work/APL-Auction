// app/overlay/demo/page.tsx
import WeatherCard from "@/components/overlays/WeatherCard";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <WeatherCard />
        </div>
    );
}

// sunny, clear, partly-cloudy, cloudy, overcast, rain, storm, snow, fog