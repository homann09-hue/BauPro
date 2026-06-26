/**
 * 2FA (MFA) enforcement policy for system administrators.
 * Admins should enable TOTP-based MFA for account security.
 */

import type { Profile } from '@/types/app';

export type MFAEnforcementLevel = 'required' | 'recommended' | 'optional';

/**
 * Determines if MFA should be enforced for a given role.
 * Currently: admins should have 2FA enabled (recommended, not required yet).
 * Can be changed to 'required' in a production hardening phase.
 */
export function getMFAEnforcementForRole(role: string): MFAEnforcementLevel {
  if (role === 'admin') {
    return 'recommended'; // Change to 'required' for production enforcement
  }
  return 'optional';
}

/**
 * Checks if a profile requires MFA based on their role.
 */
export function shouldEnforceMFA(profile: Profile): boolean {
  const level = getMFAEnforcementForRole(profile.role);
  return level === 'required';
}

/**
 * Checks if a profile has MFA enabled.
 */
export function hasMFAEnabled(mfaEnabled: boolean): boolean {
  return mfaEnabled === true;
}

/**
 * Returns a recommendation message for admin accounts without MFA.
 */
export function getMFARecommendationForAdmin(): string {
  return 'Für Systemadmin-Accounts empfehlen wir dringend, die Zwei-Faktor-Authentifizierung (2FA) zu aktivieren. Dies erhöht die Sicherheit deines Accounts.';
}

/**
 * Checks if MFA requirements are met for authentication.
 * Returns an error message if requirements are not met, null otherwise.
 */
export function validateMFARequirements(profile: Profile, mfaEnabled: boolean): string | null {
  if (!shouldEnforceMFA(profile)) {
    return null;
  }
  
  if (!hasMFAEnabled(mfaEnabled)) {
    return '2FA ist erforderlich für Systemadmin-Accounts.';
  }
  
  return null;
}
