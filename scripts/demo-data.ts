/**
 * Loads or removes clearly-labelled DEMO data, so the screens can be seen with realistic content.
 *
 *   npm run demo:load      add the sample organizations, leads, proposals, projects and demo accounts
 *   npm run demo:remove    delete everything this script created
 *
 * Safety:
 * - every record carries isDemo: true and a "[Demo]" name; demo accounts use @demo.invalid (cannot receive mail)
 * - it shows which database it will change and makes you type that database's name to continue
 * - it refuses to run in production, or when indexing is switched on for launch
 */
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { ObjectId } from "mongodb";
import { getAuth } from "@/server/auth/auth";
import { closeMongoClient, getMongoDb } from "@/server/db/mongo-client";

const DOMAIN = "demo.invalid";
const DEMO_COLLECTIONS = [
  "leads",
  "leadactivities",
  "organizations",
  "organizationmembers",
  "proposals",
  "projects",
  "milestones",
  "deliverables",
  "reviewevents",
  "projectmembers",
  "auditlogs",
] as const;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000);
const hex = () => new ObjectId().toHexString();

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function fail(message: string): never {
  console.error(`\nStopped: ${message}\n`);
  process.exit(1);
}

async function guard(database: string, action: string) {
  if (process.env.NODE_ENV === "production") fail("demo data must never be used in production.");
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true")
    fail("indexing is on (launch mode), so demo data is blocked.");
  console.log(`\nThis will ${action} in the database "${database}".`);
  const typed = await ask(`Type the database name to continue: `);
  if (typed !== database) fail("the name didn't match, so nothing was changed.");
}

async function demoUsers() {
  return getMongoDb()
    .collection("user")
    .find({ email: { $regex: `@${DOMAIN.replace(".", "\\.")}$` } })
    .toArray();
}

// ------------------------------------------------------------------------------------------------ remove

async function remove() {
  const db = getMongoDb();
  await guard(db.databaseName, "REMOVE all demo data");

  const users = await demoUsers();
  const ids = users.map((u) => String(u._id));
  const idForms = [...ids, ...users.map((u) => u._id)];
  const counts: Record<string, number> = {};

  for (const name of DEMO_COLLECTIONS) {
    counts[name] = (await db.collection(name).deleteMany({ isDemo: true })).deletedCount;
  }
  if (ids.length > 0) {
    counts.sessions = (await db.collection("session").deleteMany({ userId: { $in: idForms } })).deletedCount;
    counts.accounts = (await db.collection("account").deleteMany({ userId: { $in: idForms } })).deletedCount;
    counts.twoFactor = (
      await db.collection("twoFactor").deleteMany({ userId: { $in: idForms } })
    ).deletedCount;
    counts.users = (
      await db.collection("user").deleteMany({ _id: { $in: users.map((u) => u._id) } })
    ).deletedCount;
  }
  console.log("\nRemoved demo data:");
  for (const [name, count] of Object.entries(counts)) console.log(`  ${name}: ${count}`);
  console.log("");
}

// ------------------------------------------------------------------------------------------------ load

async function load() {
  const db = getMongoDb();
  await guard(db.databaseName, "ADD sample demo data");
  if ((await db.collection("organizations").countDocuments({ isDemo: true })) > 0) {
    fail("demo data is already loaded. Run `npm run demo:remove` first.");
  }

  // ---- accounts (created through Better Auth so their passwords are properly hashed)
  const password = randomBytes(12).toString("base64url");
  const people = [
    { key: "maya", email: `maya@${DOMAIN}`, name: "Maya Rahman (demo)", role: "client" },
    { key: "omar", email: `omar@${DOMAIN}`, name: "Omar Siddiqui (demo)", role: "client" },
    { key: "pm", email: `pm@${DOMAIN}`, name: "Sana Malik (demo PM)", role: "project_manager" },
    { key: "dev", email: `dev@${DOMAIN}`, name: "Bilal Khan (demo dev)", role: "developer" },
  ] as const;
  const auth = getAuth();
  const userId: Record<string, string> = {};
  for (const person of people) {
    const created = await auth.api.createUser({
      body: { email: person.email, password, name: person.name, role: person.role },
    });
    userId[person.key] = created.user.id;
  }
  await db
    .collection("user")
    .updateMany({ email: { $in: people.map((p) => p.email) } }, { $set: { emailVerified: true } });

  const demo = { isDemo: true } as const;
  const stamp = (created: Date, updated = created) => ({ createdAt: created, updatedAt: updated, ...demo });
  const pm = { id: userId.pm, email: `pm@${DOMAIN}`, name: "Sana Malik (demo PM)" };

  // ---- organizations and memberships
  const orgNorth = hex();
  const orgHarbor = hex();
  await db.collection("organizations").insertMany([
    {
      _id: new ObjectId(orgNorth),
      name: "[Demo] Northwind Clinics",
      contactEmail: `maya@${DOMAIN}`,
      status: "active",
      createdBy: pm.id,
      createdByEmail: pm.email,
      ...stamp(daysAgo(56)),
    },
    {
      _id: new ObjectId(orgHarbor),
      name: "[Demo] Harbor Logistics",
      contactEmail: `omar@${DOMAIN}`,
      status: "active",
      createdBy: pm.id,
      createdByEmail: pm.email,
      ...stamp(daysAgo(125)),
    },
  ]);
  await db.collection("organizationmembers").insertMany([
    { organizationId: orgNorth, userId: userId.maya, role: "member", ...stamp(daysAgo(56)) },
    { organizationId: orgHarbor, userId: userId.omar, role: "member", ...stamp(daysAgo(125)) },
  ]);

  // ---- leads
  const lead = (partial: Record<string, unknown> & { created: Date }) => {
    const { created, ...rest } = partial;
    return {
      _id: new ObjectId(),
      source: "contact-form",
      ...rest,
      ...stamp(created),
    };
  };
  const leadNorth = lead({
    referenceCode: "PSC-DEMO0001",
    name: "Maya Rahman",
    email: `maya@${DOMAIN}`,
    company: "[Demo] Northwind Clinics",
    projectType: "web-app",
    budgetRange: "5k-15k",
    timeframe: "3-6-months",
    message: "We run five clinics and want an appointment booking platform with patient and staff logins.",
    status: "won",
    organizationId: orgNorth,
    created: daysAgo(55),
  });
  const leadHarborOld = lead({
    referenceCode: "PSC-DEMO0002",
    name: "Omar Siddiqui",
    email: `omar@${DOMAIN}`,
    company: "[Demo] Harbor Logistics",
    projectType: "internal-tool",
    budgetRange: "1k-5k",
    message: "We track deliveries in spreadsheets and want a small internal tool to replace them.",
    status: "won",
    organizationId: orgHarbor,
    created: daysAgo(124),
  });
  const leadHarborNew = lead({
    referenceCode: "PSC-DEMO0003",
    name: "Omar Siddiqui",
    email: `omar@${DOMAIN}`,
    company: "[Demo] Harbor Logistics",
    projectType: "web-app",
    budgetRange: "5k-15k",
    timeframe: "1-3-months",
    message: "Following our first project, we'd like a live fleet tracking dashboard for dispatchers.",
    status: "qualified",
    organizationId: orgHarbor,
    created: daysAgo(30),
  });
  const leadContacted = lead({
    referenceCode: "PSC-DEMO0004",
    name: "Hina Farooq",
    email: `hina@${DOMAIN}`,
    company: "[Demo] Lakeside Bakery",
    projectType: "ecommerce",
    budgetRange: "1k-5k",
    message: "We'd like an online shop for our cakes, with delivery slots and card payments.",
    status: "contacted",
    created: daysAgo(12),
  });
  const leadsNew = [
    lead({
      referenceCode: "PSC-DEMO0005",
      name: "Imran Ali",
      email: `imran@${DOMAIN}`,
      projectType: "website",
      budgetRange: "under-1k",
      message: "A simple website for my tutoring business with a contact form and a price list.",
      status: "new",
      created: daysAgo(1),
    }),
    lead({
      referenceCode: "PSC-DEMO0006",
      name: "Zara Qureshi",
      email: `zara@${DOMAIN}`,
      company: "[Demo] Qureshi Textiles",
      projectType: "integration",
      message: "We need our accounting software connected to our online store so orders sync automatically.",
      status: "new",
      created: daysAgo(2),
    }),
    lead({
      referenceCode: "PSC-DEMO0007",
      name: "Omar Siddiqui",
      email: `omar@${DOMAIN}`,
      company: "[Demo] Harbor Logistics",
      projectType: "internal-tool",
      budgetRange: "1k-5k",
      timeframe: "flexible",
      message: "Could you add a driver shift scheduling screen to the tool you built for us last year?",
      status: "new",
      source: "client-portal",
      requestedBy: userId.omar,
      organizationId: orgHarbor,
      created: daysAgo(0),
    }),
  ];
  const allLeads = [leadNorth, leadHarborOld, leadHarborNew, leadContacted, ...leadsNew];
  await db.collection("leads").insertMany(allLeads);

  // ---- lead history
  const history = (
    target: { _id: ObjectId },
    entries: { body: string; days: number; from?: string; to?: string }[],
  ) =>
    entries.map((entry) => ({
      leadId: String(target._id),
      type: entry.to ? "status_change" : "note",
      ...(entry.to ? { fromStatus: entry.from, toStatus: entry.to } : {}),
      body: entry.body,
      actorId: pm.id,
      actorEmail: pm.email,
      ...stamp(daysAgo(entry.days)),
    }));
  await db.collection("leadactivities").insertMany([
    ...history(leadNorth, [
      { body: "Intro call held. They need online booking for five clinics.", days: 54 },
      { body: "Status changed.", days: 54, from: "new", to: "contacted" },
      { body: "Status changed.", days: 52, from: "contacted", to: "qualified" },
      {
        body: "Proposal PRP-DEMO0001 converted to project PRJ-DEMO0001.",
        days: 44,
        from: "qualified",
        to: "won",
      },
    ]),
    ...history(leadHarborOld, [
      { body: "Status changed.", days: 123, from: "new", to: "contacted" },
      { body: "Status changed.", days: 121, from: "contacted", to: "qualified" },
      {
        body: "Proposal PRP-DEMO0002 converted to project PRJ-DEMO0002.",
        days: 117,
        from: "qualified",
        to: "won",
      },
    ]),
    ...history(leadHarborNew, [
      { body: "Submitted from the client portal by Omar Siddiqui for [Demo] Harbor Logistics.", days: 30 },
      { body: "Status changed.", days: 29, from: "new", to: "contacted" },
      { body: "Status changed.", days: 27, from: "contacted", to: "qualified" },
    ]),
    ...history(leadContacted, [{ body: "Status changed.", days: 11, from: "new", to: "contacted" }]),
  ]);

  // ---- proposals and projects (ids are created first because they point at each other)
  const propNorth = new ObjectId();
  const propHarborOld = new ObjectId();
  const propHarborNew = new ObjectId();
  const projNorth = new ObjectId();
  const projHarbor = new ObjectId();

  const proposalBase = {
    currency: "USD",
    assumptions: ["The client supplies content and brand assets.", "One round of revisions per milestone."],
    exclusions: ["Hosting and domain costs.", "Content writing and translation."],
    createdBy: pm.id,
    createdByEmail: pm.email,
  };
  await db.collection("proposals").insertMany([
    {
      ...proposalBase,
      _id: propNorth,
      code: "PRP-DEMO0001",
      leadId: String(leadNorth._id),
      organizationId: orgNorth,
      title: "[Demo] Appointment booking platform",
      summary: "A web platform where patients book appointments online and clinic staff manage the schedule.",
      scope:
        "We will design, build and deploy a booking platform with patient accounts, a staff dashboard for each clinic, and email reminders.",
      deliverables: ["Wireframes and design", "Booking flow", "Staff dashboard", "Deployment and handover"],
      timelineSummary: "Design in weeks 1-3, build in weeks 4-9, testing and launch in week 10.",
      estimatedWeeks: 10,
      totalMinor: 980_000,
      paymentTerms: "40% to start, 30% at the midpoint review, 30% on delivery.",
      status: "accepted",
      sentAt: daysAgo(50),
      expiresAt: daysAgo(20),
      acceptedAt: daysAgo(45),
      acceptedBy: { userId: userId.maya, email: `maya@${DOMAIN}`, name: "Maya Rahman (demo)" },
      projectId: String(projNorth),
      ...stamp(daysAgo(52), daysAgo(44)),
    },
    {
      ...proposalBase,
      _id: propHarborOld,
      code: "PRP-DEMO0002",
      leadId: String(leadHarborOld._id),
      organizationId: orgHarbor,
      title: "[Demo] Delivery tracking tool",
      summary: "A small internal tool that replaces the delivery spreadsheets.",
      scope:
        "We will replace the shared spreadsheets with a tool for logging deliveries, assigning drivers and exporting weekly reports.",
      deliverables: ["Delivery tracking tool", "User guide"],
      timelineSummary: "Four weeks: two to build, one to test with the team, one to roll out.",
      estimatedWeeks: 4,
      totalMinor: 320_000,
      paymentTerms: "50% to start, 50% on delivery.",
      status: "accepted",
      sentAt: daysAgo(120),
      expiresAt: daysAgo(90),
      acceptedAt: daysAgo(118),
      acceptedBy: { userId: userId.omar, email: `omar@${DOMAIN}`, name: "Omar Siddiqui (demo)" },
      projectId: String(projHarbor),
      ...stamp(daysAgo(122), daysAgo(117)),
    },
    {
      ...proposalBase,
      _id: propHarborNew,
      code: "PRP-DEMO0003",
      leadId: String(leadHarborNew._id),
      organizationId: orgHarbor,
      title: "[Demo] Live fleet tracking dashboard",
      summary: "A dashboard that shows dispatchers where every vehicle is and which deliveries are late.",
      scope:
        "We will build a live dashboard with a map of active vehicles, delivery status, late-delivery alerts and a daily summary email for dispatchers.",
      deliverables: [
        "Live map dashboard",
        "Late-delivery alerts",
        "Daily summary email",
        "Dispatcher training session",
      ],
      timelineSummary:
        "Eight weeks: discovery and design, then two build sprints, then a pilot with two dispatchers.",
      estimatedWeeks: 8,
      totalMinor: 1_150_000,
      paymentTerms: "30% to start, 40% at the pilot, 30% on rollout.",
      status: "sent",
      sentAt: daysAgo(5),
      expiresAt: daysAhead(25),
      ...stamp(daysAgo(6), daysAgo(5)),
    },
  ]);

  const projectBase = { createdBy: pm.id, createdByEmail: pm.email };
  await db.collection("projects").insertMany([
    {
      ...projectBase,
      _id: projNorth,
      code: "PRJ-DEMO0001",
      organizationId: orgNorth,
      leadId: String(leadNorth._id),
      proposalId: String(propNorth),
      title: "[Demo] Appointment booking platform",
      summary: "A web platform where patients book appointments online and clinic staff manage the schedule.",
      status: "active",
      startedAt: daysAgo(43),
      ...stamp(daysAgo(44), daysAgo(1)),
    },
    {
      ...projectBase,
      _id: projHarbor,
      code: "PRJ-DEMO0002",
      organizationId: orgHarbor,
      leadId: String(leadHarborOld._id),
      proposalId: String(propHarborOld),
      title: "[Demo] Delivery tracking tool",
      summary: "A small internal tool that replaces the delivery spreadsheets.",
      status: "completed",
      startedAt: daysAgo(116),
      completedAt: daysAgo(60),
      ...stamp(daysAgo(117), daysAgo(60)),
    },
  ]);

  // ---- milestones, deliverables and review history
  const msDesign = new ObjectId();
  const msBooking = new ObjectId();
  const msPortal = new ObjectId();
  const msQa = new ObjectId();
  const msHarborBuild = new ObjectId();
  const msHarborLaunch = new ObjectId();
  const milestone = (
    id: ObjectId,
    projectId: ObjectId,
    position: number,
    title: string,
    status: string,
    clientVisible: boolean,
    dueDays: number,
    description?: string,
  ) => ({
    _id: id,
    projectId: String(projectId),
    title,
    description,
    dueDate: daysAhead(dueDays),
    status,
    position,
    clientVisible,
    createdBy: pm.id,
    ...stamp(daysAgo(40)),
  });
  await db
    .collection("milestones")
    .insertMany([
      milestone(
        msDesign,
        projNorth,
        0,
        "Design sign-off",
        "done",
        true,
        -20,
        "Wireframes and visual design agreed.",
      ),
      milestone(
        msBooking,
        projNorth,
        1,
        "Booking flow built",
        "in_progress",
        true,
        10,
        "Patients can find a slot and book.",
      ),
      milestone(msPortal, projNorth, 2, "Staff dashboard", "planned", true, 30),
      milestone(
        msQa,
        projNorth,
        3,
        "Internal QA checklist",
        "planned",
        false,
        40,
        "Internal only: not shown to the client.",
      ),
      milestone(msHarborBuild, projHarbor, 0, "Tool built and tested", "done", true, -80),
      milestone(msHarborLaunch, projHarbor, 1, "Rollout to the team", "done", true, -62),
    ]);

  const dWire = new ObjectId();
  const dProto = new ObjectId();
  const dStaff = new ObjectId();
  const dRunbook = new ObjectId();
  const dTool = new ObjectId();
  const dGuide = new ObjectId();
  const deliverable = (
    id: ObjectId,
    projectId: ObjectId,
    milestoneId: ObjectId | null,
    position: number,
    title: string,
    status: string,
    clientVisible: boolean,
    reviewStatus: string,
    reviewRound: number,
  ) => ({
    _id: id,
    projectId: String(projectId),
    ...(milestoneId ? { milestoneId: String(milestoneId) } : {}),
    title,
    status,
    position,
    clientVisible,
    reviewStatus,
    reviewRound,
    createdBy: pm.id,
    ...stamp(daysAgo(40)),
  });
  await db
    .collection("deliverables")
    .insertMany([
      deliverable(dWire, projNorth, msDesign, 0, "Wireframes and design", "delivered", true, "approved", 1),
      deliverable(
        dProto,
        projNorth,
        msBooking,
        1,
        "Booking flow prototype",
        "in_progress",
        true,
        "in_review",
        1,
      ),
      deliverable(
        dStaff,
        projNorth,
        msPortal,
        2,
        "Staff dashboard design",
        "in_progress",
        true,
        "changes_requested",
        1,
      ),
      deliverable(dRunbook, projNorth, null, 3, "Deployment runbook", "planned", false, "not_submitted", 0),
      deliverable(
        dTool,
        projHarbor,
        msHarborBuild,
        0,
        "Delivery tracking tool",
        "delivered",
        true,
        "approved",
        1,
      ),
      deliverable(dGuide, projHarbor, msHarborLaunch, 1, "User guide", "delivered", true, "not_submitted", 0),
    ]);

  const reviewEvent = (
    deliverableId: ObjectId,
    projectId: ObjectId,
    type: string,
    days: number,
    actor: "staff" | "client",
    name: string,
    id: string,
    message?: string,
  ) => ({
    deliverableId: String(deliverableId),
    projectId: String(projectId),
    round: 1,
    type,
    message,
    actorId: id,
    actorName: name,
    actorType: actor,
    createdAt: daysAgo(days),
    ...demo,
  });
  const staffName = "Sana Malik (demo PM)";
  const maya = "Maya Rahman (demo)";
  await db
    .collection("reviewevents")
    .insertMany([
      reviewEvent(
        dWire,
        projNorth,
        "submitted",
        24,
        "staff",
        staffName,
        userId.pm,
        "Wireframes for the booking flow and staff dashboard are ready for review.",
      ),
      reviewEvent(dWire, projNorth, "approved", 22, "client", maya, userId.maya, "Looks good, approved."),
      reviewEvent(
        dProto,
        projNorth,
        "submitted",
        2,
        "staff",
        staffName,
        userId.pm,
        "A clickable prototype of the booking flow. Please try booking a slot end to end.",
      ),
      reviewEvent(
        dStaff,
        projNorth,
        "submitted",
        9,
        "staff",
        staffName,
        userId.pm,
        "First version of the staff dashboard design.",
      ),
      reviewEvent(
        dStaff,
        projNorth,
        "changes_requested",
        7,
        "client",
        maya,
        userId.maya,
        "Please make the appointment calendar easier to read on a phone and add a filter for each clinic.",
      ),
      reviewEvent(
        dTool,
        projHarbor,
        "submitted",
        66,
        "staff",
        staffName,
        userId.pm,
        "The tracking tool is ready for your team to try.",
      ),
      reviewEvent(
        dTool,
        projHarbor,
        "approved",
        63,
        "client",
        "Omar Siddiqui (demo)",
        userId.omar,
        "Our dispatchers are happy with it.",
      ),
    ]);

  // ---- team and a little recent activity
  await db.collection("projectmembers").insertOne({
    projectId: String(projNorth),
    userId: userId.dev,
    assignedBy: pm.id,
    assignedByEmail: pm.email,
    ...stamp(daysAgo(43)),
  });
  const audit = (action: string, targetType: string, targetId: ObjectId, days: number) => ({
    action,
    actorId: pm.id,
    actorEmail: pm.email,
    targetType,
    targetId: String(targetId),
    metadata: {},
    createdAt: daysAgo(days),
    ...demo,
  });
  await db
    .collection("auditlogs")
    .insertMany([
      audit("proposal.sent", "proposal", propHarborNew, 5),
      audit("deliverable.review_submitted", "deliverable", dProto, 2),
      audit("deliverable.review_changes_requested", "deliverable", dStaff, 7),
      audit("project.member_assigned", "project", projNorth, 43),
      audit("project.created", "project", projNorth, 44),
    ]);

  console.log("\nDemo data loaded.\n");
  console.log("Demo accounts (they all share this password, shown once):");
  console.log(`  password: ${password}`);
  for (const person of people) console.log(`  ${person.email}   ${person.role}`);
  console.log("\nThey use a .invalid address, so no email can ever reach them.");
  console.log("Remove everything later with: npm run demo:remove\n");
}

async function main() {
  const command = process.argv[2];
  try {
    if (command === "load") await load();
    else if (command === "remove") await remove();
    else fail("use `load` or `remove`.");
  } finally {
    await closeMongoClient();
  }
}

main().catch((error: unknown) => {
  console.error("Demo script failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
