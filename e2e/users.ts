// Fixed accounts for the dedicated end-to-end database ONLY (see scripts/seed-e2e.ts).
// This password protects nothing real: the e2e database is wiped and recreated on every run.
export const E2E_PASSWORD = "E2e-Test-Password-123!";

export const E2E_ACCOUNTS = {
  client: { email: "client@e2e.test", name: "E2E Client", role: "client" },
  support: { email: "support@e2e.test", name: "E2E Support", role: "support" },
  admin: { email: "admin@e2e.test", name: "E2E Admin", role: "admin" },
} as const;

export const E2E_INVITEE = { email: "invitee@e2e.test", role: "client" } as const;
export const E2E_INVITE_TOKEN = "e2e-invitation-token-0123456789-abcdefghijklmnop";
