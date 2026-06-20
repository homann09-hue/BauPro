"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { HelpTipDefinition } from "@/lib/help/help-content";
import { includesGermanSearch } from "@/lib/text/german";

export function HelpCenter({ tips }: { tips: HelpTipDefinition[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const categories = useMemo(() => ["Alle", ...Array.from(new Set(tips.map((tip) => tip.category))).sort()], [tips]);
  const filtered = tips.filter((tip) => {
    const text = `${tip.title} ${tip.body} ${tip.category}`;
    return (category === "Alle" || tip.category === category) && includesGermanSearch(text, query);
  });

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <label className="field-label" htmlFor="help-search">
          Hilfe suchen
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-md border border-line bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id="help-search"
            className="min-h-12 flex-1 bg-transparent text-base outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="z. B. Mitbringliste, Wetter, Lagerstatus"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={
              item === category
                ? "inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-black text-white"
                : "inline-flex min-h-11 shrink-0 items-center rounded-md border border-line bg-white px-4 text-sm font-black text-slate-700"
            }
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((tip) => (
          <article key={tip.featureKey} className="surface p-4 sm:p-5">
            <p className="meta-label">{tip.category}</p>
            <h2 className="mt-1 text-lg font-black text-ink">{tip.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{tip.body}</p>
            {tip.steps?.length ? (
              <ol className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                {tip.steps.map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-black text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm text-slate-600">
          Kein Treffer. Probiere einen anderen Begriff oder eine andere Kategorie.
        </p>
      ) : null}
    </div>
  );
}
