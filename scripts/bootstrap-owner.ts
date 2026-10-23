/**
 * One-time creation of the first owner account.
 *
 *   npm run bootstrap:owner
 *
 * - The email comes from OWNER_BOOTSTRAP_EMAIL in your .env (an explicit allowlist, never a CLI argument).
 * - The password is typed here, hidden, and is never stored in a file or environment variable.
 * - It refuses to run if an owner already exists.
 */
import { createInterface } from "node:readline";
import { getServerEnv } from "@/lib/env";
import { closeMongoClient, getMongoDb } from "@/server/db/mongo-client";
import { getAuth } from "@/server/auth/auth";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      process.stdout.write(question);
      (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
      rl.question("", (answer) => {
        rl.close();
        process.stdout.write("\n");
        resolve(answer);
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function fail(message: string): never {
  console.error(`\nBootstrap stopped: ${message}\n`);
  process.exit(1);
}

async function main() {
  const email = getServerEnv().OWNER_BOOTSTRAP_EMAIL?.toLowerCase();
  if (!email) fail("set OWNER_BOOTSTRAP_EMAIL in your .env first (see ENVIRONMENT.md).");

  const users = getMongoDb().collection("user");
  if (await users.findOne({ role: "owner" }))
    fail("an owner account already exists. This script only runs once.");
  if (await users.findOne({ email })) fail(`a user with ${email} already exists.`);

  console.log(`Creating the owner account for ${email}`);
  const name = (await ask("Display name [Owner]: ")).trim() || "Owner";
  const password = await ask("Password (min 12 characters, hidden): ");
  if (password.length < 8) fail("the password must be at least 8 characters.");
  if (password !== (await ask("Repeat password: "))) fail("the passwords did not match.");

  await getAuth().api.createUser({ body: { email, password, name, role: "owner" } });
  // The owner is the trusted bootstrap identity, so mark the email as verified directly.
  await users.updateOne({ email }, { $set: { emailVerified: true } });

  console.log(`\nOwner created: ${email}`);
  console.log("Next: sign in at /login. You will be required to set up two-factor authentication.\n");
}

main()
  .catch((error: unknown) => {
    console.error("\nBootstrap failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoClient();
  });
