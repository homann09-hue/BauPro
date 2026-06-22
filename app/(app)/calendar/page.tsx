import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { InteractiveCalendar } from "@/components/calendar/interactive-calendar";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { calendarRangeAround, loadCalendarEvents, type CalendarEventsResult } from "@/lib/data/calendar-events";
import { safeErrorMessage, safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";

export default async function CalendarPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const range = calendarRangeAround();
  let calendarResult: CalendarEventsResult = {
    events: [],
    summary: {
      orders: 0,
      jobsites: 0,
      timeEntries: 0
    }
  };
  let loadError: string | null = null;

  try {
    calendarResult = await loadCalendarEvents(supabase, context, range.from, range.to);
  } catch (caught) {
    const queryFallback =
      safeQueryErrorMessage(caught as Parameters<typeof safeQueryErrorMessage>[0], "Kalenderdaten konnten nicht geladen werden.") ??
      "Kalenderdaten konnten nicht geladen werden.";
    loadError = safeErrorMessage(caught, queryFallback);
  }

  const hasContent = calendarResult.events.length > 0;

  return (
    <>
      <PageHeader
        title="Kalender"
        description="Interaktive Monats-, Wochen- und Listenansicht für Aufträge, Baustellen und Zeiteinträge."
      />
      <MessageBox error={error || loadError} success={success} />

      <InteractiveCalendar events={calendarResult.events} summary={calendarResult.summary} canManage={context.canManage} />

      {!hasContent ? (
        <div className="mt-5">
          <EmptyState
            icon={CalendarDays}
            title="Keine Termine im Kalenderzeitraum"
            description="Sobald Aufträge, Baustellen oder Arbeitszeiten geplant sind, erscheinen sie hier in der Kalenderansicht."
            actionHref={context.canManage ? "/orders/new" : undefined}
            actionLabel={context.canManage ? "Auftrag anlegen" : undefined}
          />
        </div>
      ) : null}
    </>
  );
}
