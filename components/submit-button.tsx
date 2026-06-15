"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
};

export function SubmitButton({
  children,
  className,
  variant = "primary"
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === "secondary" ? "btn-secondary" : variant === "danger" ? "btn-danger" : "btn-primary";

  return (
    <button type="submit" disabled={pending} className={cn(variantClass, className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Speichern..." : children}
    </button>
  );
}
