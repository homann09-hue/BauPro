export const DEMO_COMPANY_NAME = "Müller Dachtechnik GmbH";
export const DEMO_EMAIL_DOMAIN = "mueller-dachtechnik.example";
export const DEMO_CHEF_EMAIL = `chef@${DEMO_EMAIL_DOMAIN}`;
export const DEMO_DEFAULT_PASSWORD = "BauProDemo!2026";
export const DEMO_CUSTOMER_PORTAL_TOKEN = "demo-schmidt-kundenportal-2026-sicherer-beispiellink";

export const DEMO_USER_SHORTCUTS = [
  { label: "Chef", email: DEMO_CHEF_EMAIL },
  { label: "Vorarbeiter", email: `niklas@${DEMO_EMAIL_DOMAIN}` },
  { label: "Mitarbeiter", email: `max@${DEMO_EMAIL_DOMAIN}` }
] as const;
