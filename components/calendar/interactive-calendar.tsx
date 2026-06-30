"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import deLocale from "@fullcalendar/core/locales/de";
import type { DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { useRouter } from "next/navigation";
import { updateOrderDateAction } from "@/lib/actions/calendar-actions";
import type { BauProCalendarEvent, CalendarEventSummary } from "@/lib/data/calendar-events";

type InteractiveCalendarProps = {
  events: BauProCalendarEvent[];
  summary: CalendarEventSummary;
  canManage: boolean;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

const eventTypeLabels: Record<BauProCalendarEvent["extendedProps"]["type"], string> = {
  order: "Auftrag",
  jobsite: "Baustelle",
  time_entry: "Zeit"
};

function inclusiveEndDate(endStr: string) {
  const date = new Date(endStr);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function eventDateFromDrop(arg: EventDropArg) {
  return (arg.event.startStr || arg.event.start?.toISOString() || "").slice(0, 10);
}

function normalizeApiEvents(payload: unknown) {
  const data = payload as { events?: BauProCalendarEvent[] };
  return Array.isArray(data.events) ? data.events : [];
}

export function InteractiveCalendar({ events, summary, canManage }: InteractiveCalendarProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar | null>(null);
  const lastRangeRef = useRef<string>("");
  const [calendarEvents, setCalendarEvents] = useState<BauProCalendarEvent[]>(events);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    calendarRef.current?.getApi().changeView("listWeek");
  }, []);

  const stats = useMemo(
    () => [
      { label: "Aufträge", value: summary.orders },
      { label: "Baustellen", value: summary.jobsites },
      { label: "Zeiten", value: summary.timeEntries }
    ],
    [summary.jobsites, summary.orders, summary.timeEntries]
  );

  const fetchRange = useCallback(async (arg: DatesSetArg) => {
    const from = arg.startStr.slice(0, 10);
    const to = inclusiveEndDate(arg.endStr);
    const key = `${from}:${to}`;
    if (lastRangeRef.current === key) return;
    lastRangeRef.current = key;

    try {
      const response = await fetch(`/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        setNotice({ type: "error", message: "Kalenderdaten konnten nicht nachgeladen werden." });
        return;
      }

      const payload: unknown = await response.json();
      setCalendarEvents(normalizeApiEvents(payload));
    } catch {
      setNotice({ type: "error", message: "Kalenderdaten konnten nicht nachgeladen werden." });
    }
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const url = arg.event.url;
      if (!url) return;
      arg.jsEvent.preventDefault();

      try {
        const target = new URL(url, window.location.href);
        if (target.origin !== window.location.origin) {
          window.location.assign(url);
          return;
        }

        router.push(`${target.pathname}${target.search}${target.hash}`);
      } catch {
        if (url.startsWith("/") || url.startsWith("?") || url.startsWith("#")) {
          router.push(url);
          return;
        }

        window.location.assign(url);
      }
    },
    [router]
  );

  const handleEventDrop = useCallback(
    (arg: EventDropArg) => {
      const props = arg.event.extendedProps as Partial<BauProCalendarEvent["extendedProps"]>;
      const newDate = eventDateFromDrop(arg);

      if (!canManage || props.type !== "order" || !props.sourceId || !newDate) {
        arg.revert();
        setNotice({ type: "error", message: "Nur Aufträge können im Kalender verschoben werden." });
        return;
      }

      const orderId = props.sourceId;

      startTransition(() => {
        void (async () => {
          const formData = new FormData();
          formData.set("order_id", orderId);
          formData.set("new_date", newDate);

          const result = await updateOrderDateAction(formData);
          if (!result.ok) {
            arg.revert();
            setNotice({ type: "error", message: result.message });
            return;
          }

          setCalendarEvents((currentEvents) =>
            currentEvents.map((event) =>
              event.id === `order:${orderId}`
                ? {
                    ...event,
                    start: arg.event.startStr || newDate,
                    end: arg.event.endStr || event.end
                  }
                : event
            )
          );
          setNotice({ type: "success", message: result.message });
        })();
      });
    },
    [canManage]
  );

  const renderEvent = useCallback((arg: EventContentArg) => {
    const props = arg.event.extendedProps as Partial<BauProCalendarEvent["extendedProps"]>;
    const type = props.type ? eventTypeLabels[props.type] : "Termin";

    return (
      <div className="bp-calendar-event">
        <span className="bp-calendar-event__type">{type}</span>
        <span className="bp-calendar-event__title">{arg.event.title}</span>
        {props.subtitle ? <span className="bp-calendar-event__subtitle">{props.subtitle}</span> : null}
      </div>
    );
  }, []);

  return (
    <section className="surface p-3 sm:p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="section-kicker">Plantafel</p>
          <h2 className="section-title">Interaktiver Kalender</h2>
          <p className="mt-2 text-sm text-slate-500">
            Monats-, Wochen- und Listenansicht für Aufträge, Baustellen und Zeiten. Aufträge per Drag-and-Drop verschieben.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((item) => (
            <div key={item.label} className="rounded-md border border-line bg-coal px-3 py-2 text-center">
              <p className="font-display text-2xl uppercase leading-none text-ink">{item.value}</p>
              <p className="mt-1 text-[11px] font-black uppercase text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {notice ? (
        <div
          className={`mb-4 rounded-md border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-primary/35 bg-primary/10 text-ink"
              : notice.type === "error"
                ? "border-danger/35 bg-danger/10 text-ink"
                : "border-line bg-coal text-slate-300"
          }`}
          role="status"
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      {isPending ? <p className="mb-3 text-sm font-bold text-slate-500">Kalender wird gespeichert...</p> : null}

      <div className="bp-fullcalendar">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          locale={deLocale}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,listWeek"
          }}
          buttonText={{
            today: "Heute",
            month: "Monat",
            week: "Woche",
            list: "Liste"
          }}
          firstDay={1}
          nowIndicator
          height="auto"
          dayMaxEvents={3}
          navLinks
          editable={canManage}
          eventDurationEditable={false}
          eventStartEditable={canManage}
          events={calendarEvents as EventInput[]}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventContent={renderEvent}
          datesSet={(arg) => {
            void fetchRange(arg);
          }}
          slotMinTime="05:00:00"
          slotMaxTime="21:00:00"
          noEventsContent="Keine Termine in diesem Zeitraum."
        />
      </div>
    </section>
  );
}
