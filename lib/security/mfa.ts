export type TotpFactorLike = {
  factor_type?: string | null;
  status?: string | null;
};

export type MfaFactorListLike = {
  totp?: TotpFactorLike[] | null;
  all?: TotpFactorLike[] | null;
};

export function isVerifiedTotpFactor(factor: TotpFactorLike | null | undefined) {
  if (!factor) return false;

  // Supabase liefert Faktoren teilweise bereits in data.totp vorgefiltert.
  // Falls factor_type fehlt, behandeln wir den Eintrag deshalb als TOTP-Kandidat.
  const factorType = factor.factor_type ?? "totp";
  return factorType === "totp" && factor.status === "verified";
}

export function hasVerifiedTotpFactor(factors: MfaFactorListLike | null | undefined) {
  return Boolean(factors?.totp?.some(isVerifiedTotpFactor) || factors?.all?.some(isVerifiedTotpFactor));
}
