/**
 * Resets the DEDICATED end-to-end database and creates fixed test accounts and records.
 *
 *   npm run seed:e2e
 *
 * Safety: it forces the database name to "prostackcreations_e2e" and refuses to run against any
 * database whose name does not end in "_e2e", so your real data can never be wiped by mistake.
 */
import { ObjectId } from "mongodb";
import { E2E_ACCOUNTS, E2E_IDS, E2E_INVITEE, E2E_INVITE_TOKEN, E2E_PASSWORD } from "../e2e/users";

const E2E_DB = "prostackcreations_e2e";
process.env.MONGODB_DB_NAME = E2E_DB;

const oid = (hex: string) => new ObjectId(hex);

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

    // This account is disabled: it must not be able to sign in.
    await db
      .collection("user")
      .updateOne(
        { email: E2E_ACCOUNTS.disabled.email },
        { $set: { banned: true, banReason: "Disabled for the end-to-end test" } },
      );

    const now = new Date();
    const later = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    const stamps = { createdAt: now, updatedAt: now };

    // Two client organizations, each with one client account.
    await db.collection("organizations").insertMany([
      {
        _id: oid(E2E_IDS.orgA),
        name: "E2E Org A",
        status: "active",
        createdBy: "e2e-seed",
        createdByEmail: "seed@e2e.test",
        ...stamps,
      },
      {
        _id: oid(E2E_IDS.orgB),
        name: "E2E Org B",
        status: "active",
        createdBy: "e2e-seed",
        createdByEmail: "seed@e2e.test",
        ...stamps,
      },
    ]);
    const clientA = await db.collection("user").findOne({ email: E2E_ACCOUNTS.client.email });
    const clientB = await db.collection("user").findOne({ email: E2E_ACCOUNTS.clientB.email });
    await db.collection("organizationmembers").insertMany([
      { organizationId: E2E_IDS.orgA, userId: String(clientA?._id), role: "member", ...stamps },
      { organizationId: E2E_IDS.orgB, userId: String(clientB?._id), role: "member", ...stamps },
    ]);

    await db.collection("invitations").insertOne({
      email: E2E_INVITEE.email,
      role: E2E_INVITEE.role,
      organizationId: E2E_IDS.orgA,
      tokenHash: hashInviteToken(E2E_INVITE_TOKEN),
      status: "pending",
      invitedBy: "e2e-seed",
      invitedByEmail: "seed@e2e.test",
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      ...stamps,
    });

    // A qualified lead (with its organization) that has an ACCEPTED proposal ready to convert.
    await db.collection("leads").insertOne({
      _id: oid(E2E_IDS.leadQualified),
      referenceCode: "PSC-E2E00001",
      name: "E2E Lead Person",
      email: "lead@e2e.test",
      company: "E2E Org A",
      projectType: "web-app",
      message: "We need a booking application for our clinics, with staff and patient logins.",
      status: "qualified",
      organizationId: E2E_IDS.orgA,
      source: "contact-form",
      ...stamps,
    });

    const proposalBase = {
      summary: "A short summary of the work.",
      scope: "We will design, build and deploy the application over several weeks.",
      deliverables: ["Design", "Working application"],
      assumptions: [],
      exclusions: [],
      timelineSummary: "Design first, then build and release.",
      estimatedWeeks: 8,
      currency: "USD",
      totalMinor: 150000,
      paymentTerms: "50% up front, 50% on delivery.",
      createdBy: "e2e-seed",
      createdByEmail: "seed@e2e.test",
      ...stamps,
    };
    await db.collection("proposals").insertMany([
      {
        ...proposalBase,
        _id: oid(E2E_IDS.proposalAcceptedA),
        code: "PRP-E2EACCPA",
        leadId: E2E_IDS.leadQualified,
        organizationId: E2E_IDS.orgA,
        title: "Accepted proposal for A",
        status: "accepted",
        sentAt: now,
        expiresAt: later,
        acceptedAt: now,
        acceptedBy: { userId: String(clientA?._id), email: E2E_ACCOUNTS.client.email, name: "E2E Client" },
      },
      {
        ...proposalBase,
        _id: oid(E2E_IDS.proposalSentA),
        code: "PRP-E2ESENTA",
        leadId: E2E_IDS.fakeProposalA,
        organizationId: E2E_IDS.orgA,
        title: "Sent proposal for A",
        status: "sent",
        sentAt: now,
        expiresAt: later,
      },
      {
        ...proposalBase,
        _id: oid(E2E_IDS.proposalDraftA),
        code: "PRP-E2EDRAFA",
        leadId: E2E_IDS.fakeProposalA,
        organizationId: E2E_IDS.orgA,
        title: "Draft proposal for A",
        status: "draft",
      },
      {
        ...proposalBase,
        _id: oid(E2E_IDS.proposalSentB),
        code: "PRP-E2ESENTB",
        leadId: E2E_IDS.fakeProposalB,
        organizationId: E2E_IDS.orgB,
        title: "Sent proposal for B",
        status: "sent",
        sentAt: now,
        expiresAt: later,
      },
    ]);

    // One project per organization, each with a visible and a hidden milestone and deliverable.
    const projectBase = {
      summary: "An existing project.",
      status: "active",
      createdBy: "e2e-seed",
      createdByEmail: "seed@e2e.test",
      ...stamps,
    };
    await db.collection("projects").insertMany([
      {
        ...projectBase,
        _id: oid(E2E_IDS.projectA),
        code: "PRJ-E2EPROJA",
        organizationId: E2E_IDS.orgA,
        leadId: E2E_IDS.fakeProposalA,
        proposalId: E2E_IDS.fakeProposalA,
        title: "E2E Project A",
      },
      {
        ...projectBase,
        _id: oid(E2E_IDS.projectB),
        code: "PRJ-E2EPROJB",
        organizationId: E2E_IDS.orgB,
        leadId: E2E_IDS.fakeProposalB,
        proposalId: E2E_IDS.fakeProposalB,
        title: "E2E Project B",
      },
    ]);
    const item = { status: "planned", position: 0, createdBy: "e2e-seed", ...stamps };
    await db.collection("milestones").insertMany([
      { ...item, projectId: E2E_IDS.projectA, title: "Visible milestone A", clientVisible: true },
      {
        ...item,
        projectId: E2E_IDS.projectA,
        title: "Hidden milestone A",
        clientVisible: false,
        position: 1,
      },
      { ...item, projectId: E2E_IDS.projectB, title: "Milestone B secret", clientVisible: true },
    ]);
    await db.collection("deliverables").insertMany([
      { ...item, projectId: E2E_IDS.projectA, title: "Visible deliverable A", clientVisible: true },
      {
        ...item,
        projectId: E2E_IDS.projectA,
        title: "Hidden deliverable A",
        clientVisible: false,
        position: 1,
      },
      { ...item, projectId: E2E_IDS.projectB, title: "Deliverable B secret", clientVisible: true },
    ]);

    // The developer is assigned to project A only.
    const developer = await db.collection("user").findOne({ email: E2E_ACCOUNTS.developer.email });
    await db.collection("projectmembers").insertOne({
      projectId: E2E_IDS.projectA,
      userId: String(developer?._id),
      assignedBy: "e2e-seed",
      assignedByEmail: "seed@e2e.test",
      ...stamps,
    });

    console.log(
      `Seeded ${db.databaseName}: ${Object.keys(E2E_ACCOUNTS).join(", ")}, two organizations, proposals and projects.`,
    );
  } finally {
    await closeMongoClient();
  }
}

main().catch((error: unknown) => {
  console.error("E2E seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
