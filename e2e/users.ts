// Fixed accounts and records for the dedicated end-to-end database ONLY (see scripts/seed-e2e.ts).
// This password protects nothing real: the e2e database is wiped and recreated on every run.
export const E2E_PASSWORD = "E2e-Test-Password-123!";

export const E2E_ACCOUNTS = {
  client: { email: "client@e2e.test", name: "E2E Client", role: "client" },
  clientB: { email: "client-b@e2e.test", name: "E2E Client B", role: "client" },
  support: { email: "support@e2e.test", name: "E2E Support", role: "support" },
  pm: { email: "pm@e2e.test", name: "E2E Project Manager", role: "project_manager" },
  admin: { email: "admin@e2e.test", name: "E2E Admin", role: "admin" },
} as const;

export const E2E_INVITEE = { email: "invitee@e2e.test", role: "client" } as const;
export const E2E_INVITE_TOKEN = "e2e-invitation-token-0123456789-abcdefghijklmnop";

// Fixed 24-character ids so tests can open records by URL.
export const E2E_IDS = {
  orgA: "e2e000000000000000000008",
  orgB: "e2e000000000000000000009",
  leadQualified: "e2e000000000000000000001",
  proposalAcceptedA: "e2e000000000000000000002",
  proposalSentA: "e2e000000000000000000003",
  proposalDraftA: "e2e000000000000000000004",
  proposalSentB: "e2e000000000000000000005",
  projectA: "e2e000000000000000000006",
  projectB: "e2e000000000000000000007",
  fakeProposalA: "e2e00000000000000000000a",
  fakeProposalB: "e2e00000000000000000000b",
} as const;
