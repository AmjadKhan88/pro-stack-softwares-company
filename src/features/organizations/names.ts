import "server-only";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { Organization } from "./models/organization";

export async function organizationNamesById(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(isObjectId);
  if (unique.length === 0) return new Map();
  await connectToDatabase();
  const organizations = await Organization.find({ _id: { $in: unique } })
    .select("name")
    .lean();
  return new Map(organizations.map((organization) => [String(organization._id), organization.name]));
}
