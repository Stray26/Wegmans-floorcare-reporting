import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Store } from "lucide-react";
import { PageHeader } from "@/components/layout/PageShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Frequency = "daily" | "weekly" | "monthly";
const FREQ: Frequency[] = ["daily", "weekly", "monthly"];

interface StoreRef {
  outerTierId: string;
  name: string;
}
interface SubscriptionRow {
  id: string;
  email: string;
  member_id: string | null;
  frequency: Frequency;
  enabled: boolean;
  stores_override: StoreRef[] | null;
  last_sent_at: string | null;
}
interface RecipientSummary {
  member_id: string;
  email: string;
  display_name: string | null;
  stores: StoreRef[];
  captured_at: string;
}
interface AdminData {
  subscriptions: SubscriptionRow[];
  recipients: RecipientSummary[];
  availableStores: StoreRef[];
}

const selectCls =
  "h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

async function jsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed.");
  return data;
}

/** Checkbox list of stores the admin can assign. */
function StoreChecks({
  stores,
  selected,
  onToggle,
}: {
  stores: StoreRef[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (stores.length === 0) {
    return <p className="text-xs text-muted-foreground">No stores available to assign.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {stores.map((s) => {
        const on = selected.has(s.outerTierId);
        return (
          <button
            key={s.outerTierId}
            type="button"
            onClick={() => onToggle(s.outerTierId)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              on
                ? "border-brand-900 bg-brand-900/10 text-brand-900"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s.name || s.outerTierId}
          </button>
        );
      })}
    </div>
  );
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
  const [addStores, setAddStores] = React.useState<Set<string>>(new Set());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editStores, setEditStores] = React.useState<Set<string>>(new Set());

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
  const stores = data?.availableStores ?? [];
  const recByEmail = new Map(recipients.map((r) => [r.email.toLowerCase(), r]));
  const storesFromIds = (ids: Set<string>) => stores.filter((s) => ids.has(s.outerTierId));
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function effectiveStores(s: SubscriptionRow): StoreRef[] {
    if (s.stores_override && s.stores_override.length > 0) return s.stores_override;
    return recByEmail.get(s.email.toLowerCase())?.stores ?? [];
  }

  function addSubscription() {
    const e = email.trim();
    if (!e) return;
    const match = recByEmail.get(e.toLowerCase());
    save.mutate(
      {
        email: e,
        frequency,
        member_id: match?.member_id ?? null,
        ...(addStores.size > 0 ? { stores_override: storesFromIds(addStores) } : {}),
      },
      {
        onSuccess: () => {
          setEmail("");
          setAddStores(new Set());
          toast({ title: "Subscription saved", description: `${e} · ${frequency}`, variant: "success" });
        },
      }
    );
  }

  function startEdit(s: SubscriptionRow) {
    setEditingId(s.id);
    setEditStores(new Set(effectiveStores(s).map((o) => o.outerTierId)));
  }
  function saveEdit(s: SubscriptionRow) {
    save.mutate(
      {
        id: s.id,
        email: s.email,
        member_id: s.member_id,
        frequency: s.frequency,
        enabled: s.enabled,
        stores_override: storesFromIds(editStores),
      },
      { onSuccess: () => setEditingId(null) }
    );
  }

  return (
    <div>
      <PageHeader
        title="Report Emails"
        subtitle="Who receives the scheduled Floorcare PDF, and how often. Stores come from each person's login automatically — or assign them manually for recipients who haven't logged in yet."
      />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Add recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
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
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Stores (optional — only needed if the recipient hasn’t logged in; otherwise their own stores are used)
            </p>
            <StoreChecks stores={stores} selected={addStores} onToggle={toggle(setAddStores)} />
          </div>
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
                const eff = effectiveStores(s);
                const manual = !!(s.stores_override && s.stores_override.length > 0);
                const editing = editingId === s.id;
                return (
                  <div key={s.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
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
                      <button
                        onClick={() => (editing ? setEditingId(null) : startEdit(s))}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Store className="h-3.5 w-3.5" />
                        {eff.length > 0
                          ? `${eff.length} store${eff.length > 1 ? "s" : ""}${manual ? " · manual" : ""}`
                          : "no stores"}
                      </button>
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
                    {editing && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">
                          Assign stores (overrides login-captured stores). Leave all unchecked to
                          fall back to the recipient’s own stores.
                        </p>
                        <StoreChecks
                          stores={stores}
                          selected={editStores}
                          onToggle={toggle(setEditStores)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" disabled={save.isPending} onClick={() => saveEdit(s)}>
                            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Save stores
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
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
