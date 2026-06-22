"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, ShieldCheck, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { updateEmployeePermissionsAction } from "@/lib/actions/auth-actions";
import { employeePermissionGroups, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/app";

type EmployeePermissionsMenuProps = {
  employeeId: string;
  employeeName: string;
  employeeRole: Role;
  grantedPermissions: PermissionKey[];
  disabledReason?: string;
};

export function EmployeePermissionsMenu({
  employeeId,
  employeeName,
  employeeRole,
  grantedPermissions,
  disabledReason
}: EmployeePermissionsMenuProps) {
  const [open, setOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const granted = new Set(grantedPermissions);
  const disabled = Boolean(disabledReason);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  function clearLongPress() {
    if (!longPressTimer.current) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function openFromContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    setOpen(true);
  }

  function openFromLongPress() {
    clearLongPress();
    longPressTimer.current = setTimeout(() => setOpen(true), 450);
  }

  return (
    <div className="rounded-md border border-line bg-slate-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onContextMenu={openFromContextMenu}
          onTouchStart={openFromLongPress}
          onTouchEnd={clearLongPress}
          onTouchCancel={clearLongPress}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-md bg-white px-3 py-2 text-left shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-primary/30 focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-haspopup="dialog"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-ink">{employeeName}</span>
            <span className="block text-xs font-bold text-slate-500">
              Rechte per Klick, Long-Press oder Rechtsklick öffnen
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/15"
          aria-label={`Rechte für ${employeeName} bearbeiten`}
        >
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
          Rechte
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          <div className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full overflow-hidden rounded-t-lg border border-line bg-white shadow-lift sm:max-w-3xl sm:rounded-lg">
            <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
              <div>
                <p className="section-kicker">Rechteverwaltung</p>
                <h2 className="text-xl font-black text-ink">{employeeName}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Rolle: {employeeRole}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-fog text-ink transition hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/15"
                aria-label="Rechte-Menü schließen"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {disabled ? (
              <div className="max-h-[70dvh] overflow-y-auto p-4 sm:p-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  {disabledReason}
                </div>
              </div>
            ) : (
              <form action={updateEmployeePermissionsAction}>
                <input type="hidden" name="id" value={employeeId} />
                <div className="max-h-[68dvh] space-y-4 overflow-y-auto p-4 pb-28 sm:max-h-[70dvh] sm:p-5 sm:pb-5">
                  {employeePermissionGroups.map((group) => (
                    <fieldset key={group.id} className="rounded-lg border border-line bg-fog p-3 sm:p-4">
                      <legend className="px-1 text-sm font-black text-ink">{group.title}</legend>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {group.permissions.map((permission) => (
                          <label
                            key={permission.key}
                            className={cn(
                              "flex min-h-14 items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm",
                              granted.has(permission.key) ? "border-primary/40 ring-1 ring-primary/20" : "border-line"
                            )}
                          >
                            <input
                              type="checkbox"
                              name="permission"
                              value={permission.key}
                              defaultChecked={granted.has(permission.key)}
                              className="h-5 w-5 rounded border-line text-primary"
                            />
                            {permission.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <div className="fixed inset-x-0 bottom-0 z-[81] border-t border-line bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:static sm:flex sm:justify-end sm:gap-2 sm:p-4">
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                      Abbrechen
                    </button>
                    <SubmitButton>Speichern</SubmitButton>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
