import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

// Better Auth's admin plugin only governs its own "user" and "session" actions.
// Everything else (leads, projects, content...) is governed by src/server/policies/permissions.ts.
// "impersonate" is deliberately granted to nobody.
export const ac = createAccessControl(defaultStatements);

export const roles = {
  owner: ac.newRole({
    user: ["create", "list", "set-role", "ban", "delete", "get", "update", "set-password"],
    session: ["list", "revoke", "delete"],
  }),
  admin: ac.newRole({ user: ["list", "get", "ban"], session: ["list", "revoke"] }),
  project_manager: ac.newRole({}),
  developer: ac.newRole({}),
  content_manager: ac.newRole({}),
  support: ac.newRole({}),
  client: ac.newRole({}),
};
