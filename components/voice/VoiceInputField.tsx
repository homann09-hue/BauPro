"use client";

import { useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Check, Mic, MicOff, Trash2, TriangleAlert } from "lucide-react";
import { appendTranscript, createGermanSpeechRecognition, supportsSpeechRecognition, type VoiceInputState } from "@/lib/voice/speech";
import { cn } from "@/lib/utils";

type BaseProps = {
  id?: string;
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  voiceLabel?: string;
};

type VoiceInputFieldProps = BaseProps & {
  as?: "input";
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
};

type VoiceTextareaProps = BaseProps & {
  as: "textarea";
  rows?: number;
};

type Props = VoiceInputFieldProps | VoiceTextareaProps;

export function VoiceInputField(props: Props) {
  const {
    id,
    name,
    label,
    help,
    placeholder,
    defaultValue,
    required,
    className,
    value,
    onValueChange,
    voiceLabel = "Spracheingabe"
  } = props;
  const fieldId = id ?? name;
  const controlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<VoiceInputState>("idle");
  const [supported] = useState(() => supportsSpeechRecognition());
  const recognitionRef = useRef<ReturnType<typeof createGermanSpeechRecognition>>(null);
  const currentValue = controlled ? value : innerValue;

  function setFieldValue(nextValue: string) {
    if (!controlled) setInnerValue(nextValue);
    onValueChange?.(nextValue);
  }

  function start() {
    const recognition = createGermanSpeechRecognition();
    if (!recognition) {
      setState("unsupported");
      return;
    }

    recognitionRef.current = recognition;
    setDraft("");
    setState("listening");
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setDraft((current) => appendTranscript(current, transcript));
        setState("review");
      }
    };
    recognition.onerror = () => setState("error");
    recognition.onend = () => {
      setState((current) => (current === "listening" ? "idle" : current));
    };
    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    setState((current) => (current === "listening" ? "review" : current));
  }

  function acceptDraft() {
    setFieldValue(appendTranscript(currentValue, draft));
    setDraft("");
    setState("idle");
  }

  function discardDraft() {
    setDraft("");
    setState("idle");
  }

  const inputClassName = cn("field-input pr-14", props.as === "textarea" ? "min-h-24 resize-y" : "", className);

  return (
    <div>
      {label ? (
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        {props.as === "textarea" ? (
          <textarea
            className={inputClassName}
            id={fieldId}
            name={name}
            rows={props.rows ?? 4}
            placeholder={placeholder}
            value={currentValue}
            onChange={(event) => setFieldValue(event.target.value)}
            required={required}
          />
        ) : (
          <input
            className={inputClassName}
            id={fieldId}
            name={name}
            type={props.type ?? "text"}
            inputMode={props.inputMode}
            placeholder={placeholder}
            value={currentValue}
            onChange={(event) => setFieldValue(event.target.value)}
            required={required}
          />
        )}
        <button
          type="button"
          onClick={state === "listening" ? stop : start}
          className={cn(
            "absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm shadow-sm transition",
            state === "listening"
              ? "border-red-200 bg-red-50 text-danger"
              : "border-line bg-white text-primary hover:border-primary/40 hover:bg-mint"
          )}
          aria-label={state === "listening" ? "Aufnahme stoppen" : `${voiceLabel} starten`}
          title={state === "listening" ? "Aufnahme stoppen" : "Diktieren"}
        >
          {state === "listening" ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {help ? <p className="field-help">{help}</p> : null}
      {state === "unsupported" || (!supported && state !== "idle") ? (
        <p className="mt-2 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-900">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          Spracheingabe wird von diesem Browser nicht unterstuetzt. Tippen funktioniert weiter.
        </p>
      ) : null}
      {state === "error" ? (
        <p className="mt-2 flex gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-semibold text-danger">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          Aufnahme konnte nicht gestartet werden. Bitte Text normal eingeben.
        </p>
      ) : null}
      {draft ? (
        <div className="mt-2 rounded-md border border-primary/20 bg-mint p-3">
          <p className="meta-label">Erkannt, bitte prüfen</p>
          <p className="mt-1 text-sm font-semibold text-ink">{draft}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-primary min-h-10 px-3 py-2 text-xs" onClick={acceptDraft}>
              <Check className="h-4 w-4" aria-hidden="true" />
              Übernehmen
            </button>
            <button type="button" className="btn-secondary min-h-10 px-3 py-2 text-xs" onClick={discardDraft}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Verwerfen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
