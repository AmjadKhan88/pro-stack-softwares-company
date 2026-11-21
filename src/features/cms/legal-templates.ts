import type { Block } from "./block-types";

export interface DraftPage {
  slug: string;
  title: string;
  summary: string;
  blocks: Block[];
}

// STARTING POINTS, not legal advice. They describe what this platform actually does today. Anything that is a
// legal or business decision is a [[placeholder]], and the system refuses to publish text that still has one.
// Have a qualified lawyer review both pages before you publish them.

const note = (what: string): Block => ({
  type: "richtext",
  text: `> [[DRAFT: delete this note once a qualified lawyer has reviewed this ${what} and every placeholder has been replaced.]]`,
});

export function legalDraftPages(site: { name: string; email: string; location: string }): DraftPage[] {
  const privacy: DraftPage = {
    slug: "privacy",
    title: "Privacy policy",
    summary: "How we collect, use and protect your information.",
    blocks: [
      note("page"),
      {
        type: "richtext",
        text: [
          "## Who we are",
          `${site.name} is [[legal entity name and registration details]], based in ${site.location}. You can reach us at ${site.email}.`,
          "## What we collect, and why",
          "**When you send an enquiry.** We collect your name, email address, your company (if you give it), the type of project, a budget range and timeframe (if you give them) and your message. We use them to reply to you and to prepare a proposal.",
          "**When you have an account.** We store your name, email address and role, a record of your sign-ins, and a securely hashed password. Staff accounts also use two-factor authentication.",
          "**When you use the client portal.** We store the proposals, projects, milestones, deliverables and review comments that belong to your organization, and a record of who approved or asked for changes, and when.",
          "**To keep the site safe.** To limit spam and abuse we keep a one-way hash of your IP address and of the email address used in forms. A hash can't be turned back into the original.",
          "## Cookies and browser storage",
          "We use a sign-in cookie to keep you signed in and to protect your account, and your browser remembers your light or dark theme choice. We do not use advertising or analytics cookies. [[Update this section if analytics or other tracking is added.]]",
          "## Who we share data with",
          "We use these providers to run the site, and they process data on our behalf: MongoDB Atlas (our database), Cloudinary (website images), Google (sending email) and [[hosting provider]] (hosting). [[Add any others, and say where each stores data.]]",
          "## How long we keep it",
          "[[How long enquiries, accounts and project records are kept, and what happens afterwards.]]",
          "## Your choices",
          `[[Describe how people can ask to see, correct or delete their data, and any rights that apply where you operate.]] You can write to us at ${site.email}.`,
          "## Changes to this policy",
          "We will update this page when our practices change. [[Date of the last update.]]",
        ].join("\n\n"),
      },
    ],
  };

  const terms: DraftPage = {
    slug: "terms",
    title: "Terms of service",
    summary: "The terms that apply to our website and our services.",
    blocks: [
      note("page"),
      {
        type: "richtext",
        text: [
          "## About these terms",
          `These terms apply to your use of this website and to the services ${site.name} provides. ${site.name} is [[legal entity name and registration details]].`,
          "## Our services",
          "We agree the scope, price, timeline and payment terms for each project in a written proposal. Work starts once you accept the proposal. Anything not listed as included in the proposal is not part of the project.",
          "## Estimates and changes",
          "Timelines in a proposal are our honest estimates, not guarantees. If the scope changes we will tell you what it affects before we continue. [[How change requests are agreed and priced.]]",
          "## Payment",
          "[[Payment schedule, currency, late payment and refund terms.]]",
          "## Ownership of the work",
          "[[Who owns the code, designs and other deliverables, and when ownership transfers, including third-party and open-source components.]]",
          "## Using this website",
          "Please don't misuse the website, try to reach accounts or data that aren't yours, or interfere with how it works.",
          "## Liability",
          "[[Limits on liability and any warranties, as advised by your lawyer.]]",
          "## Governing law",
          "[[Governing law, and where disputes are handled.]]",
          "## Contact",
          `Questions about these terms: ${site.email}.`,
        ].join("\n\n"),
      },
    ],
  };

  return [privacy, terms];
}
