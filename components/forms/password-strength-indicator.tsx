"use client";

import { useMemo, useState } from "react";
import zxcvbn from "zxcvbn";
import { cn } from "@/lib/utils";

export type PasswordStrengthIndicatorProps = {
  password: string;
};

const scoreMeta = {
  0: { label: "Zu schwach", color: "bg-danger", text: "text-danger", activeSegments: 1 },
  1: { label: "Zu schwach", color: "bg-danger", text: "text-danger", activeSegments: 1 },
  2: { label: "Schwach", color: "bg-signal", text: "text-amber-700", activeSegments: 2 },
  3: { label: "Mittel", color: "bg-yellow-400", text: "text-yellow-700", activeSegments: 3 },
  4: { label: "Stark", color: "bg-primary", text: "text-primary-dark", activeSegments: 4 }
} as const;

const suggestionTranslations: Record<string, string> = {
  "Use a few words, avoid common phrases.": "Nutze mehrere Wörter und vermeide bekannte Standardphrasen.",
  "No need for symbols, digits, or uppercase letters.": "Sonderzeichen, Zahlen oder Großbuchstaben sind hilfreich, aber nicht allein entscheidend.",
  "Add another word or two. Uncommon words are better.": "Ergänze ein oder zwei weitere Wörter. Ungewöhnliche Wörter sind besser.",
  "Capitalization doesn't help very much.": "Groß-/Kleinschreibung allein macht das Passwort kaum stärker.",
  "All-uppercase is almost as easy to guess as all-lowercase.": "Nur Großbuchstaben sind fast so leicht zu erraten wie nur Kleinbuchstaben.",
  "Reversed words aren't much harder to guess.": "Rückwärts geschriebene Wörter sind nicht viel sicherer.",
  "Predictable substitutions like '@' instead of 'a' don't help very much.": "Vorhersehbare Ersetzungen wie '@' statt 'a' helfen nur wenig.",
  "Avoid repeated words and characters.": "Vermeide Wiederholungen von Wörtern und Zeichen.",
  "Avoid sequences.": "Vermeide einfache Reihenfolgen wie 1234 oder abcd.",
  "Avoid recent years.": "Vermeide aktuelle Jahreszahlen.",
  "Avoid years that are associated with you.": "Vermeide Jahreszahlen mit persönlichem Bezug.",
  "Avoid dates and years that are associated with you.": "Vermeide Daten und Jahre mit persönlichem Bezug."
};

const warningTranslations: Record<string, string> = {
  "Straight rows of keys are easy to guess.": "Tastatur-Reihen wie qwertz sind leicht zu erraten.",
  "Short keyboard patterns are easy to guess.": "Kurze Tastaturmuster sind leicht zu erraten.",
  "Repeats like \"aaa\" are easy to guess.": "Wiederholungen wie \"aaa\" sind leicht zu erraten.",
  "Repeats like \"abcabcabc\" are only slightly harder to guess than \"abc\".": "Wiederholte Muster sind nur wenig sicherer als das Grundmuster.",
  "Sequences like abc or 6543 are easy to guess.": "Reihenfolgen wie abc oder 6543 sind leicht zu erraten.",
  "Recent years are easy to guess.": "Aktuelle Jahreszahlen sind leicht zu erraten.",
  "Dates are often easy to guess.": "Datumsangaben sind oft leicht zu erraten.",
  "This is a top-10 common password.": "Dieses Passwort gehört zu den häufigsten Passwörtern.",
  "This is a top-100 common password.": "Dieses Passwort gehört zu den sehr häufigen Passwörtern.",
  "This is a very common password.": "Dieses Passwort ist sehr häufig.",
  "This is similar to a commonly used password.": "Dieses Passwort ähnelt einem häufig verwendeten Passwort.",
  "A word by itself is easy to guess.": "Ein einzelnes Wort ist leicht zu erraten.",
  "Names and surnames by themselves are easy to guess.": "Namen allein sind leicht zu erraten.",
  "Common names and surnames are easy to guess.": "Häufige Namen sind leicht zu erraten."
};

function translateFeedback(value: string) {
  return suggestionTranslations[value] ?? warningTranslations[value] ?? "Wähle ein längeres, weniger vorhersehbares Passwort.";
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const result = useMemo(() => (password.length > 0 ? zxcvbn(password) : null), [password]);

  if (!result) return null;

  const meta = scoreMeta[result.score as keyof typeof scoreMeta];
  const feedback = [result.feedback.warning, ...result.feedback.suggestions].filter(Boolean).map(translateFeedback);

  return (
    <div className="mt-2 rounded-md border border-line bg-fog p-3" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-normal text-slate-500">Passwort-Stärke</span>
        <span className={cn("text-sm font-black", meta.text)}>{meta.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-2 rounded-full transition",
              segment < meta.activeSegments ? meta.color : "bg-white"
            )}
          />
        ))}
      </div>
      {feedback.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs font-semibold text-slate-600">
          {feedback.slice(0, 2).map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-semibold text-slate-600">Sieht gut aus. Verwende dieses Passwort nur für BauPro.</p>
      )}
    </div>
  );
}

export function PasswordInputWithStrength({
  id,
  name = "password",
  label = "Passwort",
  placeholder,
  autoComplete = "new-password",
  required = true,
  helpText
}: {
  id: string;
  name?: string;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  helpText?: string;
}) {
  const [password, setPassword] = useState("");

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="field-input"
        id={id}
        name={name}
        type="password"
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {helpText ? <p className="field-help">{helpText}</p> : null}
      <PasswordStrengthIndicator password={password} />
    </div>
  );
}
