import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("session timeout guard", () => {
  it("tracks activity, warns after inactivity and signs out with a safe reason", () => {
    const guard = source("components/session-timeout-guard.tsx");

    expect(guard).toContain("export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000");
    for (const eventName of ["mousedown", "keydown", "touchstart", "scroll"]) {
      expect(guard).toContain(eventName);
    }
    expect(guard).toContain("ACTIVITY_THROTTLE_MS = 10 * 1000");
    expect(guard).toContain("Du wirst in 60 Sekunden automatisch abgemeldet wegen Inaktivität.");
    expect(guard).toContain("Angemeldet bleiben");
    expect(guard).toContain('formData.set("reason", "inactivity")');
    expect(guard).toContain("signOutAction(formData)");
  });

  it("wires the company setting through context, settings page and database schema", () => {
    const auth = source("lib/auth.ts");
    const layout = source("app/(app)/layout.tsx");
    const settings = source("app/(app)/settings/page.tsx");
    const migration = source("supabase/migrations/20260623_session_timeout_setting.sql");
    const schema = source("supabase/schema.sql");
    const actions = source("lib/actions/auth-actions.ts");

    expect(auth).toContain("companies(id, name, session_timeout_minutes, onboarding_completed_at)");
    expect(auth).toContain("session_timeout_minutes: Number.isFinite(sessionTimeoutMinutes)");
    expect(layout).toContain("<SessionTimeoutGuard sessionTimeoutMinutes={context.company.session_timeout_minutes} />");
    expect(settings).toContain('name="session_timeout_minutes"');
    expect(settings).toContain("Automatische Abmeldung nach");
    expect(actions).toContain("sessionTimeoutMinutesFromForm");
    expect(actions).toContain("session_timeout_minutes: sessionTimeoutMinutes");
    for (const sql of [migration, schema]) {
      expect(sql).toContain("session_timeout_minutes integer not null default 30");
      expect(sql).toContain("companies_session_timeout_minutes_check");
      expect(sql).toContain("session_timeout_minutes between 0 and 1440");
    }
  });
});
