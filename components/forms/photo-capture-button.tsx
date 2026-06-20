"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, X } from "lucide-react";

type Preview = {
  name: string;
  url: string;
};

export function PhotoCaptureButton({
  name,
  label = "Foto aufnehmen",
  required = false,
  multiple = false
}: {
  name: string;
  label?: string;
  required?: boolean;
  multiple?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);

  function revokeCurrentUrls() {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }

  function setFilesPreview(files: File[]) {
    revokeCurrentUrls();
    const nextPreviews = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return {
        name: file.name || "Baustellenfoto",
        url
      };
    });
    setPreviews(nextPreviews);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setFilesPreview(Array.from(event.currentTarget.files ?? []));
  }

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
    setFilesPreview([]);
  }

  function removePhoto(indexToRemove: number) {
    const input = inputRef.current;
    const files = Array.from(input?.files ?? []);
    const nextFiles = files.filter((_, index) => index !== indexToRemove);

    if (!input || nextFiles.length === 0) {
      clearInput();
      return;
    }

    if (typeof DataTransfer === "undefined") {
      clearInput();
      return;
    }

    const transfer = new DataTransfer();
    nextFiles.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    setFilesPreview(nextFiles);
  }

  useEffect(() => {
    return () => revokeCurrentUrls();
  }, []);

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        data-testid={`${name}-file-input`}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        required={required}
        className="sr-only"
        onChange={handleChange}
      />

      <label
        htmlFor={inputId}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-moss bg-mint px-4 py-3 text-base font-black text-moss shadow-soft transition hover:bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-moss active:scale-[0.99]"
      >
        <Camera className="h-5 w-5" aria-hidden="true" />
        {label}
      </label>

      {previews.length > 0 ? (
        <div className="rounded-md border border-line bg-fog p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-ink">
              {previews.length === 1 ? "1 Foto ausgewählt" : `${previews.length} Fotos ausgewählt`}
            </p>
            <button type="button" className="text-sm font-bold text-moss hover:text-primary-dark" onClick={clearInput}>
              Alle entfernen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((preview, index) => (
              <div key={`${preview.url}-${index}`} className="relative overflow-hidden rounded-md border border-line bg-white">
                <img src={preview.url} alt={preview.name} className="h-28 w-full object-cover" decoding="async" />
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-clay shadow-soft hover:bg-fog"
                  onClick={() => removePhoto(index)}
                  aria-label={`${preview.name} entfernen`}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
                <p className="truncate px-2 py-2 text-xs font-semibold text-slate-600">{preview.name}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
