"use client";

import { useCallback, useState } from "react";

type JobsiteOption = {
  id: string;
  name: string;
  customer: string | null;
};

type JobsitesResponse = {
  jobsites?: JobsiteOption[];
  error?: string;
};

export function JobsiteSelectField({ name, required = false }: { name: string; required?: boolean }) {
  const [jobsites, setJobsites] = useState<JobsiteOption[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadJobsites = useCallback(() => {
    if (status !== "idle") return;
    setStatus("loading");

    void fetch("/api/materials/inventory/jobsites", {
      headers: { accept: "application/json" }
    })
      .then(async (response) => {
        const payload = (await response.json()) as JobsitesResponse;
        if (!response.ok || payload.error) {
          setStatus("error");
          return;
        }

        setJobsites(payload.jobsites ?? []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [status]);

  return (
    <select className="field-input" name={name} required={required} onFocus={loadJobsites} onPointerDown={loadJobsites} defaultValue="">
      <option value="" disabled>
        {status === "idle" ? "Baustelle auswählen" : null}
        {status === "loading" ? "Baustellen werden geladen..." : null}
        {status === "ready" && jobsites.length === 0 ? "Keine aktive Baustelle verfügbar" : null}
        {status === "error" ? "Baustellen konnten nicht geladen werden" : null}
      </option>
      {jobsites.map((jobsite) => (
        <option key={jobsite.id} value={jobsite.id}>
          {jobsite.name}
          {jobsite.customer ? ` · ${jobsite.customer}` : ""}
        </option>
      ))}
    </select>
  );
}
