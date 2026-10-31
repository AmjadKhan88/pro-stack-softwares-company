/**
 * Resets the DEDICATED end-to-end database and creates fixed test accounts.
 *
 *   npm run seed:e2e
 *
 * Safety: it forces the database name to "prostackcreations_e2e" and refuses to run against any
 * database whose name does not end in "_e2e", so your real data can never be wiped by mistake.
 */
import { E2E_ACCOUNTS, E2E_INVITEE, E2E_INVITE_TOKEN, E2E_PASSWORD } from "../e2e/users";

const E2E_DB = "prostackcreations_e2e";
process.env.MONGODB_DB_NAME = E2E_DB;

async function main() {
  // Imported after the env override above so every module sees the e2e database name.
  const { closeMongoClient, getMongoDb } = await import("@/server/db/mongo-client");
  const { getAuth } = await import("@/server/auth/auth");
  const { hashInviteToken } = await import("@/features/invitations/tokens");

  try {
    const db = getMongoDb();
    if (!db.databaseName.endsWith("_e2e")) {
      throw new Error(`Refusing to reset "${db.databaseName}": not an _e2e database.`);
    }
    await db.dropDatabase();

    const auth = getAuth();
    for (const account of Object.values(E2E_ACCOUNTS)) {
      await auth.api.createUser({
        body: { email: account.email, password: E2E_PASSWORD, name: account.name, role: account.role },
      });
    }
    await db
      .collection("user")
      .updateMany(
        { email: { $in: Object.values(E2E_ACCOUNTS).map((a) => a.email) } },
        { $set: { emailVerified: true } },
      );

    const now = new Date();
    await db.collection("invitations").insertOne({
      email: E2E_INVITEE.email,
      role: E2E_INVITEE.role,
      tokenHash: hashInviteToken(E2E_INVITE_TOKEN),
      status: "pending",
      invitedBy: "e2e-seed",
      invitedByEmail: "seed@e2e.test",
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Seeded ${db.databaseName}: ${Object.keys(E2E_ACCOUNTS).join(", ")} + 1 pending invitation.`);
  } finally {
    await closeMongoClient();
  }
}

main().catch((error: unknown) => {
  console.error("E2E seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
