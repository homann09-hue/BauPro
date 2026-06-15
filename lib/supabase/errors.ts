type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const typed = error as SupabaseLikeError;
  return [typed.code, typed.message, typed.details, typed.hint].filter(Boolean).join(" ");
}

export function isMissingSchemaError(error: unknown) {
  const text = errorText(error);
  return (
    text.includes("42P01") ||
    text.includes("42703") ||
    text.includes("PGRST205") ||
    text.includes("Could not find the table") ||
    text.includes("Could not find the column") ||
    text.includes("does not exist")
  );
}

export function isUnsupportedVorarbeiterRoleError(error: unknown) {
  const text = errorText(error);
  return text.includes("profiles_role_check") || (text.includes("violates check constraint") && text.includes("role"));
}

export function migrationMissingMessage(feature: string) {
  return `${feature} ist im Code vorbereitet, aber die Supabase-Migration fehlt noch. Die App laeuft weiter; bitte Migration spaeter im Supabase SQL Editor ausfuehren.`;
}
