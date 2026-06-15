import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Frequency = "daily" | "weekly" | "monthly";
const FREQ: Frequency[] = ["daily", "weekly", "monthly"];

interface SubscriptionRow {
  id: string;
  email: string;
  member_id: string | null;
  frequency: Frequency;
  enabled: boolean;
  last_sent_at: string | null;
}
interface RecipientSummary {
  member_id: string;
  email: string;
  display_name: string | null;
  stores: { outerTierId: string; name: string }[];
  captured_at: string;
}
interface AdminData {
  subscriptions: SubscriptionRow[];
  recipients: RecipientSummary[];
}

const selectCls =
  "h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed.");
  return data;
}

export function ReportSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useQuery<AdminData>({
    queryKey: ["admin-subscriptions"],
    queryFn: () =>
      fetch("/api/admin/subscriptions", { credentials: "same-origin" }).then(
        jsonOrThrow
      ) as Promise<AdminData>,
  });

  const [email, setEmail] = React.useState("");
  const [frequency, setFrequency] = React.useState<Frequency>("weekly");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      }).then(jsonOrThrow),
    onSuccess: invalidate,
    onError: (e) => toast({ title: "Couldn’t save", description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/subscriptions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      }).then(jsonOrThrow),
    onSuccess: invalidate,
    onError: (e) => toast({ title: "Couldn’t delete", description: (e as Error).message }),
  });

  const subs = data?.subscriptions ?? [];
  const recipients = data?.recipients ?? [];
  const recByEmail = new Map(recipients.map((r) => [r.email.toLowerCase(), r]));

  function addSubscription() {
    const e = email.trim();
    if (!e) return;
    const match = recByEmail.get(e.toLowerCase());
    save.mutate(
      { email: e, frequency, member_id: match?.member_id ?? null },
      {
        onSuccess: () => {
          setEmail("");
          toast({ title: "Subscription saved", description: `${e} · ${frequency}`, variant: "success" });
        },
      }
    );
  }

  return (
    <div>
      <PageHeader
        title="Report Emails"
        subtitle="Who receives the scheduled Floorcare PDF, and how often. Each recipient is scoped to their own stores automatically."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Add recipient</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
            <Input
              list="recipient-emails"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@wegmans.com"
            />
            <datalist id="recipient-emails">
              {recipients.map((r) => (
                <option key={r.member_id} value={r.email}>
                  {r.display_name ?? r.email}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Frequency</span>
            <select
              className={selectCls}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              {FREQ.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={addSubscription} disabled={save.isPending || !email.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="py-6 text-center text-sm text-status-failed">
              {(error as Error)?.message ?? "Couldn’t load."}
            </p>
          ) : subs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No subscriptions yet — add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => {
                const rec = recByEmail.get(s.email.toLowerCase());
                const storeCount = rec?.stores.length ?? 0;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-[200px] flex-1 font-medium">{s.email}</span>
                    <select
                      className={selectCls}
                      value={s.frequency}
                      onChange={(e) =>
                        save.mutate({
                          id: s.id,
                          email: s.email,
                          member_id: s.member_id,
                          frequency: e.target.value,
                          enabled: s.enabled,
                        })
                      }
                    >
                      {FREQ.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        save.mutate({
                          id: s.id,
                          email: s.email,
                          member_id: s.member_id,
                          frequency: s.frequency,
                          enabled: !s.enabled,
                        })
                      }
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        s.enabled
                          ? "bg-status-passed-bg text-status-passed"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {s.enabled ? "Enabled" : "Paused"}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {storeCount > 0
                        ? `${storeCount} store${storeCount > 1 ? "s" : ""}`
                        : "no captured stores — needs a portal login"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
