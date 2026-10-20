import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { StatusPill, Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { ToastDemo } from "@/components/shared/toast-demo";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-8">
      <PageHeader
        eyebrow="Internal"
        title="Design system"
        description="Components and tokens shared by the public site, client portal and admin."
        actions={<ThemeSwitcher />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField id="ds-name" label="Project name" hint="Visible to the client." required>
            {(c) => <Input placeholder="e.g. Inventory system" {...c} />}
          </FormField>
          <FormField id="ds-email" label="Email" error="Enter a valid email address.">
            {(c) => <Input type="email" defaultValue="not-an-email" {...c} />}
          </FormField>
          <FormField id="ds-brief" label="Brief" className="sm:col-span-2">
            {(c) => <Textarea placeholder="What are we building, and for whom?" {...c} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status and badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <StatusPill status="live">Live</StatusPill>
          <StatusPill status="review">In review</StatusPill>
          <StatusPill status="blocked">Blocked</StatusPill>
          <StatusPill status="archived">Archived</StatusPill>
          <StatusPill status="draft">Draft</StatusPill>
          <Badge>Neutral</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Table</CardTitle>
        </CardHeader>
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Sample row (demo only)</Td>
              <Td className="text-muted-foreground">—</Td>
              <Td>
                <StatusPill status="draft">Draft</StatusPill>
              </Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState title="Nothing here yet" description="Empty states explain what will appear and why." />
        <ErrorState />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loading and toasts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <ToastDemo />
        </CardContent>
      </Card>
    </div>
  );
}
