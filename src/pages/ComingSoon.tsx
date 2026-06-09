import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";

/** Placeholder for Phase 2 pages (Custom Detail Report, Tickets, Score Settings). */
export function ComingSoon({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Planned for Phase 2</p>
        <p className="max-w-md text-sm text-muted-foreground">
          This page is part of the next build phase. The data layer, types, and
          Smart Inspect transforms it needs are already in place.
        </p>
      </Card>
    </div>
  );
}
