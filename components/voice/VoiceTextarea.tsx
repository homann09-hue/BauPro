"use client";

import { VoiceInputField } from "@/components/voice/VoiceInputField";

type VoiceTextareaProps = {
  id?: string;
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  defaultValue?: string | null;
  required?: boolean;
  rows?: number;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function VoiceTextarea(props: VoiceTextareaProps) {
  return <VoiceInputField {...props} as="textarea" />;
}
