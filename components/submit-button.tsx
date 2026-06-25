"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
  disabled?: boolean;
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  className,
  variant = "primary",
  name,
  value,
  disabled = false,
  pendingLabel = "Speichern..."
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );
  const variantClass =
    variant === "secondary" ? "btn-secondary" : variant === "danger" ? "btn-danger" : "btn-primary";
  const isDisabled = pending || disabled || !hydrated;

  return (
    <button type="submit" disabled={isDisabled} className={cn(variantClass, className)} name={name} value={value}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
