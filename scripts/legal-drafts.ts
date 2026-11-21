/**
 * Creates DRAFT Privacy and Terms pages from the starting-point templates, so you can edit them in the admin.
 *
 *   npm run content:legal-drafts
 *
 * It only creates drafts (nothing becomes public), skips a page that already exists, and the system will refuse
 * to publish a page while any [[placeholder]] is left in it.
 */
import mongoose from "mongoose";
import { siteConfig } from "@/config/site";
import { legalDraftPages } from "@/features/cms/legal-templates";
import { ContentEntry } from "@/features/cms/models/content-entry";
import { createEntry } from "@/features/cms/service";

async function main() {
  const actor = { id: "system", email: process.env.OWNER_BOOTSTRAP_EMAIL ?? "system@localhost" };
  const pages = legalDraftPages({
    name: siteConfig.name,
    email: siteConfig.email,
    location: siteConfig.location,
  });

  for (const page of pages) {
    const exists = await ContentEntry.exists({ type: "page", slug: page.slug });
    if (exists) {
      console.log(`Skipped "${page.slug}": a page with that address already exists.`);
      continue;
    }
    const result = await createEntry({
      type: "page",
      parsed: {
        slug: page.slug,
        data: { title: page.title, summary: page.summary, blocks: page.blocks },
        seo: { noindex: false },
      },
      actor,
    });
    console.log(
      result.ok
        ? `Created a draft "${page.slug}". Open Admin > Pages to edit it.`
        : `Could not create "${page.slug}": ${result.reason}.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
