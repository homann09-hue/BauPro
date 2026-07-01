"use client";

import dynamic from "next/dynamic";
import type { InteractiveCalendarProps } from "@/components/calendar/interactive-calendar";

const CalendarLoadingState = () => (
  <section className="surface p-3 sm:p-5" aria-label="Kalender wird geladen">
    <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <div className="skeleton-line h-3 w-24" />
        <div className="skeleton-line mt-3 h-7 w-56" />
        <div className="skeleton-line mt-3 h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-md border border-line bg-coal px-3 py-3">
            <div className="skeleton-line mx-auto h-7 w-10" />
            <div className="skeleton-line mx-auto mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
    <div className="skeleton-line h-[420px] w-full rounded-lg" />
  </section>
);

const InteractiveCalendar = dynamic(
  () => import("@/components/calendar/interactive-calendar").then((module) => module.InteractiveCalendar),
  {
    loading: CalendarLoadingState,
    ssr: false
  }
);

export function InteractiveCalendarLoader(props: InteractiveCalendarProps) {
  return <InteractiveCalendar {...props} />;
}
