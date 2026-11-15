import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/features/invitations/rules";
import type { AssignableStaff, TeamMember } from "@/features/projects/team-service";
import { isRole } from "@/server/policies/permissions";
import { AddTeamMemberForm } from "./add-team-member-form";
import { RemoveTeamMemberForm } from "./remove-team-member-form";

function roleLabel(role: string | null): string {
  return isRole(role) ? ROLE_LABELS[role] : "Unknown role";
}

export function ProjectTeamCard({
  projectId,
  team,
  candidates,
  canManage,
  open,
}: {
  projectId: string;
  team: TeamMember[];
  candidates: AssignableStaff[];
  canManage: boolean;
  open: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {team.length === 0 ? (
          <p className="text-muted-foreground text-sm">No one is assigned to this project yet.</p>
        ) : (
          <ul className="space-y-3">
            {team.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {roleLabel(member.role)} · {member.email}
                  </p>
                </div>
                {canManage ? (
                  <RemoveTeamMemberForm projectId={projectId} userId={member.userId} name={member.name} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage && open ? (
          <AddTeamMemberForm
            projectId={projectId}
            candidates={candidates.map((c) => ({ id: c.id, label: `${c.name} (${roleLabel(c.role)})` }))}
          />
        ) : null}
        {canManage && !open ? (
          <p className="text-muted-foreground text-sm">
            This project is closed, so no one can be added. Members can still be removed.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
